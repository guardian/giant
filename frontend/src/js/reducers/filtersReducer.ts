export default function filters(state: any = [], action: any) {
  switch (action.type) {
    case "FILTERS_GET_RECEIVE":
      return action.filters || false;

    default:
      return state;
  }
}
