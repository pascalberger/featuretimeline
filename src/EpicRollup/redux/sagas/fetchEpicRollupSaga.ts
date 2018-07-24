import { all, call, put, select } from "redux-saga/effects";
import { BacklogConfiguration } from 'TFS/Work/Contracts';
import { WorkItemTrackingHttpClient } from 'TFS/WorkItemTracking/RestClient';
import * as VSS_Service from 'VSS/Service';
import { PageWorkItemHelper } from '../../../Common/Helpers/PageWorkItemHelper';
import { restoreOverriddenIterations } from '../../../Common/modules/OverrideIterations/overriddenIterationsSaga';
import { getProjectId } from '../../../Common/Selectors/CommonSelectors';
import { backlogConfigurationForProjectSelector } from "../modules/backlogconfiguration/backlogconfigurationselector";
import { WorkItemsActionCreator } from '../modules/workItems/workItemActions';
import { fetchBacklogConfiguration } from "./fetchBacklogConfigurationSaga";
import { fetchTeamIterations } from './fetchTeamSettingsSaga';
import WitContracts = require('TFS/WorkItemTracking/Contracts');

export function* fetchEpicRollup(epicId: number) {
    debugger;
    const projectId = getProjectId();
    // get backlog configuration for the project
    yield all([fetchBacklogConfiguration(), fetchTeamIterations()]);
    const backlogConfiguration: BacklogConfiguration = yield select(backlogConfigurationForProjectSelector);

    // const portfolioBacklogs = backlogconfiguration.portfolioBacklogs;
    // const requiermentBacklog = backlogconfiguration.requirementBacklog;

    // const featureTypes = portfolioBacklogs[0].workItemTypes;
    // const storyTypes = requiermentBacklog.workItemTypes;
    const stackRankFieldRefName = backlogConfiguration.backlogFields.typeFields["Order"];
    const effortsFieldRefName = backlogConfiguration.backlogFields.typeFields["Effort"];
    const teamFieldRefName = backlogConfiguration.backlogFields.typeFields["Team"];

    // get all children including grand children
    // Target is child and source is parent
    const parentChildWiql = `SELECT [System.Id] 
                FROM WorkItemLinks 
                WHERE (Source.[System.Id] IN(${ epicId}) )
                    AND [System.Links.LinkType] IN ('System.LinkTypes.Hierarchy-Forward')
                    AND Target.[System.WorkItemType] <> '' mode(Recursive)`;

    const witHttpClient = VSS_Service.getClient(WorkItemTrackingHttpClient);
    const parentChildQueryResults: WitContracts.WorkItemQueryResult = yield call([witHttpClient, witHttpClient.queryByWiql], { query: parentChildWiql }, projectId);

    yield put(WorkItemsActionCreator.epicHierarchyReceived(parentChildQueryResults.workItemRelations));

    const workItemIds: number[] = parentChildQueryResults.workItemRelations.map(rel => rel.target.id);
    // Source is successor target is predecessor
    const dependenciesWiql = `SELECT [System.Id] 
                                FROM WorkItemLinks 
                                WHERE (Source.[System.Id] IN(${ workItemIds.join(",")}) )
                                    AND [System.Links.LinkType] IN ('System.LinkTypes.Dependency-Reverse')
                                    AND Target.[System.WorkItemType] <> ''`;

    const dependenciesQueryResult: WitContracts.WorkItemQueryResult = yield call([witHttpClient, witHttpClient.queryByWiql], { query: dependenciesWiql }, projectId);
    yield put(WorkItemsActionCreator.dependenciesReceived(dependenciesQueryResult.workItemRelations));

    const predecessorWorkItemIds = dependenciesQueryResult.workItemRelations.map(rel => rel.target.id);

    // check if there are any dependencies that are cross epic, if any filter them out and show message
    // const crossEpicDependencies = predecessorWorkItemIds.filter(pwit => !workItemIds.some(w => w === pwit));

    const fields = ["System.Id",
        "System.Title",
        "System.AssignedTo",
        "System.State",
        "System.IterationId",
        "System.IterationPath",
        "System.WorkItemType",
        stackRankFieldRefName,
        effortsFieldRefName,
        teamFieldRefName];

    const pagedWorkItems: WitContracts.WorkItem[] = yield call(PageWorkItemHelper.pageWorkItems, workItemIds.concat(predecessorWorkItemIds), projectId, fields);
    yield put(WorkItemsActionCreator.pagedWorkItemsReceived(pagedWorkItems));

    // LATER: check if there are any dependencies that are cross project, if any filter them out and show message

    // build epic hierarchy
    // build dependency tree

    // Fetch overridden iteration start/end dates
    yield call(restoreOverriddenIterations);
    // find the earliest iteration as per the work items above
    // find the latest iteration as per the work items above
    // filter out all iterations expect -1 and +1 of above range
}

    // fetch all the iterations for the project
    // sort the iterations
    // mark iteration with duplicate start/end dates
    // find overlapping iterations and group them in a pseudo iteration section

