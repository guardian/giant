import { fetchNodes } from "../services/ClusterApi";

export function getNodes() {
  return (dispatch) => {
    dispatch(requestNodes());
    return fetchNodes()
      .then((res) => {
        dispatch(receiveNodes(res));
      })
      .catch((error) => dispatch(errorReceivingNodes(error)));
  };
}

function requestNodes() {
  return {
    type: "NODES_GET_REQUEST",
    receivedAt: Date.now(),
  };
}

function receiveNodes(nodes) {
  return {
    type: "NODES_GET_RECEIVE",
    nodes: nodes,
    receivedAt: Date.now(),
  };
}

function errorReceivingNodes(error) {
  return {
    type: "APP_SHOW_ERROR",
    message: "Failed to get nodes",
    error: error,
    receivedAt: Date.now(),
  };
}
