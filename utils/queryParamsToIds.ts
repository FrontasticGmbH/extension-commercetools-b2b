function queryParamsToIds(param: string, queryParams: any) {
  const Ids: string[] = [];

  const requestParamIds = queryParams?.[param];

  if (requestParamIds) {
    if (Array.isArray(requestParamIds)) {
      Ids.push(...requestParamIds);
    } else {
      const params = requestParamIds.split(',');
      if (params.length > 1) {
        Ids.push(...params);
      } else {
        Ids.push(requestParamIds);
      }
    }
  }

  return Ids;
}

export default queryParamsToIds;
