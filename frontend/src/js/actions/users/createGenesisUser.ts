import {
  genesisSetupInitialDatabaseUserApi,
  genesisSetupInitialPandaUserApi,
} from "../../services/UserApi";

export function createDatabaseProviderGenesisUser(
  username: string,
  displayName: string,
  password: string,
  totpActivation: any,
) {
  return (dispatch: any) => {
    dispatch(requestCreateGenesisUser(username));
    return genesisSetupInitialDatabaseUserApi(
      username,
      displayName,
      password,
      totpActivation,
    )
      .then((res) => {
        dispatch(receiveCreateGenesisUser(res.username));
      })
      .catch((error) =>
        dispatch(errorReceivingCreateGenesisUser(error, username)),
      );
  };
}

export function createPandaProviderGenesisUser(email: string) {
  return (dispatch: any) => {
    dispatch(requestCreateGenesisUser(email));
    return genesisSetupInitialPandaUserApi(email)
      .then((res) => {
        dispatch(receiveCreateGenesisUser(res.username));
      })
      .catch((error) =>
        dispatch(errorReceivingCreateGenesisUser(error, email)),
      );
  };
}

function requestCreateGenesisUser(username: string) {
  return {
    type: "GENESIS_CREATE_USER_REQUEST",
    username: username,
    receivedAt: Date.now(),
  };
}

function receiveCreateGenesisUser(username: string) {
  return {
    type: "GENESIS_CREATE_USER_RECEIVE",
    username: username,
    receivedAt: Date.now(),
  };
}

function errorReceivingCreateGenesisUser(error: any, username: string) {
  return {
    type: "GENESIS_CREATE_USER_ERROR",
    message: `Failed to create genesis user ${username}`,
    error: error,
    receivedAt: Date.now(),
  };
}
