import moment = require("moment");

export interface IProject {
    id: string;
    title: string;
}

export interface IProjectConfiguration {
    id: string;

    /**
     * Name of the Epic backlog level. Used for navigation to epic roadmap.
     */
    epicBacklogLevelName: string;

    /**
     * Default work item type associated to the Microsoft.EpicCategory portfolio backlog level for the project.
     */
    defaultEpicWorkItemType: string;

    /**
     * Default work item type associated to the Microsoft.RequirementCategory backlog level for the project.
     */
    defaultRequirementWorkItemType: string;

    effortWorkItemFieldRefName: string;

    effortODataColumnName: string;
}

export interface ITeam {
    teamId: string;
    teamName: string;
}

export interface IEpic {
    id: number;
    project: string;
    teamId: string;
    backlogLevel: string;
    title: string;
    startDate?: Date;
    endDate?: Date;

    completedCount: number;
    totalCount: number;

    completedEffort: number;
    totalEffort: number;

    effortProgress: number;
    countProgress: number;
}

export interface IAddItems {
    planId: string;
    projectId: string;
    itemIdsToAdd: number[];
    workItemType: string;
    epicBacklogLevelName: string;
    requirementWorkItemType: string;
    effortWorkItemFieldRefName: string;
}

export interface IRemoveItem {
    planId: string;
    itemIdToRemove: number;
}

export interface ITimelineGroup {
    id: string;
    title: string;
}

export interface ITimelineItem {
    id: number;
    group: string;
    teamId: string;
    backlogLevel: string;
    title: string;
    start_time: moment.Moment;
    end_time: moment.Moment;
}

export enum ProgressTrackingCriteria {
    CompletedCount = "Completed Count",
    Effort = "Effort"
}

export enum LoadingStatus {
    NotLoaded,
    Loaded
}

export class ExtensionConstants {
    public static EXTENSION_ID: string = "workitem-feature-timeline-extension";
    public static EXTENSION_ID_BETA: string = `${ExtensionConstants.EXTENSION_ID}-beta`;
}
