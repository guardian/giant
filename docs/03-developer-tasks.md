# Common developer tasks

## Running with pan domain auth

If you want to run with pan domain auth enabled you'll need to set up [login.gutools](https://github.com/guardian/login.gutools)
and also setup the nginx config for this project using [dev-nginx](https://github.com/guardian/dev-nginx):

```
dev-nginx <path_of_pfi>/nginx/nginx-mapping.yml
```

Next change the `auth.provider` setting in `application.conf` from `database` to `panda`.

Then you will need workflow and investigations credentials to issue and verify cookies.

Finally you should be able to open PFI and log in using pan domain auth.

## Running against a stack in AWS

You can port forward to neo4j and Elasticsearch instances running in AWS if you need to develop against real data.

Add the following to `site.conf`:

```
aws.region = "eu-west-1"
aws.stack = {{STACK_NAME - eg pfi-playground}}
aws.app = "pfi"
aws.stage = "rex"
aws.runningLocally = true
auth.provider = {{whatever is configured for that stack eg database, panda}}
```

It will expect the tunnels to be running on port 17687 for neo4j and 19200 for Elasticsearch. There are helper scripts
for this in [investigations-platform](https://github.com/guardian/investigations-platform):

```
# In a checkout of investigations-platform
./util/connect_to_neo4j.sh {{STACK_NAME - eg pfi-playground}}
./util/connect_to_elasticearch.sh {{STACK_NAME - eg pfi-playground}}
```

If you are connecting to a Panda authenticated instance you must follow the instructions above to run
[login.gutools](https://github.com/guardian/login.gutools) locally.