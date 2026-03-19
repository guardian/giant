export function clearSearch() {
  return (dispatch: any) => {
    dispatch({
      type: "SEARCH_CLEAR",
      receivedAt: Date.now(),
    });
  };
}
