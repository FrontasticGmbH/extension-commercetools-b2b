import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { getCurrency, getLocale } from '../utils/requestHandlers/Request';
import ProjectApi from '../apis/ProjectApi';
import handleError from '@Commerce-commercetools/utils/handleError';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

export const getProjectSettings: ActionHook = async (request: Request, actionContext: ActionContext) => {
  try {
    const projectApi = new ProjectApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

    const project = await projectApi.getProjectSettings();

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(project),
      sessionData: request.sessionData,
    };

    return response;
  } catch (error) {
    return handleError(error, request);
  }
};
