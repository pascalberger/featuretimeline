import { put, call } from "redux-saga/effects";
import { effects } from "redux-saga";
import { PortfolioPlanningDataService } from "../../Common/Services/PortfolioPlanningDataService";
import {
    PortfolioPlanningQueryInput,
    PortfolioPlanning,
    PortfolioPlanningFullContentQueryResult,
    MergeType
} from "../../Models/PortfolioPlanningQueryModels";
import { EpicTimelineActions } from "../Actions/EpicTimelineActions";
import { SetDefaultDatesForEpics } from "./DefaultDateUtil";
import { PortfolioTelemetry } from "../../Common/Utilities/Telemetry";

export function* LoadPortfolio(planId: string) {
    const portfolioService = PortfolioPlanningDataService.getInstance();
    const planInfo: PortfolioPlanning = yield call([portfolioService, portfolioService.GetPortfolioPlanById], planId);

    // No data for this plan, just return empty info
    if (!planInfo.projects || Object.keys(planInfo.projects).length === 0) {
        yield put(
            EpicTimelineActions.portfolioItemsReceived({
                items: {
                    exceptionMessage: null,
                    items: []
                },
                projects: {
                    exceptionMessage: null,
                    projects: [],
                    projectConfigurations: {}
                },
                teamAreas: {
                    exceptionMessage: null,
                    teamsInArea: {}
                },
                mergeStrategy: MergeType.Replace
            })
        );

        return;
    }

    const backlogLevelNameByProject: { [projectId: string]: string } = {};

    const portfolioQueryInput: PortfolioPlanningQueryInput = {
        WorkItems: Object.keys(planInfo.projects).map(projectKey => {
            const projectInfo = planInfo.projects[projectKey];
            const projectIdLowerCase = projectInfo.ProjectId.toLowerCase();

            if (!backlogLevelNameByProject[projectIdLowerCase]) {
                backlogLevelNameByProject[projectIdLowerCase] = projectInfo.PortfolioBacklogLevelName;
            }

            return {
                projectId: projectInfo.ProjectId,
                WorkItemTypeFilter: projectInfo.PortfolioWorkItemType,
                DescendantsWorkItemTypeFilter: projectInfo.RequirementWorkItemType,
                EffortWorkItemFieldRefName: projectInfo.EffortWorkItemFieldRefName,
                EffortODataColumnName: projectInfo.EffortODataColumnName,
                workItemIds: projectInfo.WorkItemIds
            };
        })
    };

    const queryResult: PortfolioPlanningFullContentQueryResult = yield call(
        [portfolioService, portfolioService.loadPortfolioContent],
        portfolioQueryInput,
        backlogLevelNameByProject
    );

    //  Check if projects had missing backlog level names, if so, we need to update the stored plan.
    let needsUpdate = false;
    Object.keys(planInfo.projects).forEach(projectId => {
        const projectInfo = planInfo.projects[projectId];
        if (!projectInfo.PortfolioBacklogLevelName) {
            needsUpdate = true;
            projectInfo.PortfolioBacklogLevelName =
                queryResult.projects.projectConfigurations[projectInfo.ProjectId.toLowerCase()].epicBacklogLevelName;
        }
    });

    if (needsUpdate) {
        PortfolioTelemetry.getInstance().TrackAction("MissingBacklogLevelNameWhileLoadingPortfolio");
        yield effects.call([portfolioService, portfolioService.UpdatePortfolioPlan], planInfo);
    }

    yield effects.call(SetDefaultDatesForEpics, queryResult);

    //  Replace all values when merging. We are loading the full state of the portfolio here.
    queryResult.mergeStrategy = MergeType.Replace;

    yield put(EpicTimelineActions.portfolioItemsReceived(queryResult));
}
