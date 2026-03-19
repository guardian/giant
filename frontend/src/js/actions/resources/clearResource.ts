export function clearResource() {
  return (dispatch: any) => {
    dispatch(() => ({
      type: "RESOURCE_CLEAR",
      receivedAt: Date.now(),
    }));
  };
}
