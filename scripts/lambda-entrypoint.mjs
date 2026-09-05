/**
 * The container's entrypoint: fetch this app's secrets from SSM Parameter
 * Store, put them in the environment, then start the standalone server in this
 * same process.
 *
 * Parameter Store rather than Secrets Manager because Secrets Manager is $0.40
 * per secret per month and five secrets across nine apps is $18/month for
 * something Parameter Store does free. Read here rather than injected as Lambda
 * environment variables so the values are in neither the CloudFormation
 * template nor `GetFunctionConfiguration`.
 *
 * One API call per cold start, then cached for the life of the container.
 */

/** A plausible environment variable name: the shape a shell would accept. */
const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/;

export function envNameFor(parameterName, prefix) {
  const base = prefix.endsWith('/') ? prefix : `${prefix}/`;
  if (!parameterName.startsWith(base)) return null;
  const name = parameterName.slice(base.length);
  return ENV_NAME.test(name) ? name : null;
}

export function envFromParameters(parameters, prefix) {
  const env = {};
  for (const parameter of parameters) {
    const name = envNameFor(parameter.Name ?? '', prefix);
    if (name && parameter.Value !== undefined) env[name] = parameter.Value;
  }
  return env;
}

async function loadSecrets(prefix) {
  const { SSMClient, GetParametersByPathCommand } = await import('@aws-sdk/client-ssm');
  const client = new SSMClient({});
  const parameters = [];
  let NextToken;
  do {
    const page = await client.send(
      new GetParametersByPathCommand({
        Path: prefix,
        WithDecryption: true,
        Recursive: false,
        NextToken,
      }),
    );
    parameters.push(...(page.Parameters ?? []));
    NextToken = page.NextToken;
  } while (NextToken);
  return envFromParameters(parameters, prefix);
}

async function main() {
  const prefix = process.env.SSM_PARAMETER_PREFIX;
  if (prefix) {
    try {
      Object.assign(process.env, await loadSecrets(prefix));
    } catch (error) {
      // Best-effort, like every other read on the play path. Without a database
      // the app still draws the first question and records nothing, which is a
      // far better outcome than a container that refuses to start.
      console.error('Failed to load parameters from SSM', error);
    }
  }
  await import('../server.js');
}

// Only run when this file is the entrypoint, so the test can import the two
// pure functions without starting a server.
if (process.argv[1]?.endsWith('lambda-entrypoint.mjs')) {
  await main();
}
