import * as React from "react";
import "./PlanPage.scss";
import { Page } from "azure-devops-ui/Page";
import PlanHeader from "./PlanHeader";
import { ConnectedPlanTimeline } from "./PlanTimeline";
import { PlanSummary } from "./PlanSummary";
import { IPortfolioPlanningState } from "../../Redux/Contracts";
import {
    getProjectNames,
    getTeamNames,
    getSelectedItem,
    getEpicIds,
    getPlanExtendedTelemetry
} from "../../Redux/Selectors/EpicTimelineSelectors";
import { getSelectedPlanMetadata } from "../../Redux/Selectors/PlanDirectorySelectors";
import { connect } from "react-redux";
import { PlanDirectoryActions } from "../../Redux/Actions/PlanDirectoryActions";
import { EpicTimelineActions } from "../../Redux/Actions/EpicTimelineActions";
import { PortfolioPlanningMetadata } from "../../Models/PortfolioPlanningQueryModels";
import { PlanSettingsPanel } from "./PlanSettingsPanel";
import { ProgressTrackingCriteria, ITimelineItem, LoadingStatus } from "../../Contracts";
import { AddItemPanel } from "./AddItemPanel";
import { DetailsDialog } from "./DetailsDialog";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import { Link } from "azure-devops-ui/Link";
import { DeletePlanDialog } from "./DeletePlanDialog";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { PortfolioTelemetry } from "../../Common/Utilities/Telemetry";
import { ExtendedSinglePlanTelemetry } from "../../Models/TelemetryModels";

interface IPlanPageMappedProps {
    plan: PortfolioPlanningMetadata;
    projectNames: string[];
    teamNames: string[];
    epicIds: { [epicId: number]: number };
    selectedItem: ITimelineItem;
    progressTrackingCriteria: ProgressTrackingCriteria;
    addItemPanelOpen: boolean;
    setDatesDialogHidden: boolean;
    planSettingsPanelOpen: boolean;
    exceptionMessage: string;
    planLoadingStatus: LoadingStatus;
    isNewPlanExperience: boolean;
    deletePlanDialogHidden: boolean;
    planTelemetry: ExtendedSinglePlanTelemetry;
}

export type IPlanPageProps = IPlanPageMappedProps & typeof Actions;

export default class PlanPage extends React.Component<IPlanPageProps, IPortfolioPlanningState> {
    constructor(props: IPlanPageProps) {
        super(props);
    }

    public render() {
        return (
            <Page className="plan-page">
                {this._renderPlanHeader()}
                {this._renderPlanContent()}
                {this._renderAddItemPanel()}
                {this._renderItemDetailsDialog()}
                {this._renderPlanSettingsPanel()}
                {this._renderDeletePlanDialog()}
            </Page>
        );
    }

    private _renderPlanHeader = (): JSX.Element => {
        return (
            <>
                <PlanHeader
                    id={this.props.plan.id}
                    name={this.props.plan.name}
                    description={this.props.plan.description}
                    disabled={!!this.props.exceptionMessage}
                    itemIsSelected={!!this.props.selectedItem}
                    onAddItemClicked={this.props.onOpenAddItemPanel}
                    onRemoveSelectedItemClicked={this._onRemoveSelectedEpicClick}
                    onBackButtonClicked={this._backButtonClicked}
                    onSettingsButtonClicked={this._settingsButtonClicked}
                    onDeletePlanButonClicked={() => this.props.toggleDeletePlanDialogHidden(false)}
                />
                <PlanSummary
                    projectNames={this.props.projectNames}
                    teamNames={this.props.teamNames}
                    owner={this.props.plan.owner}
                />
            </>
        );
    };

    private _renderPlanContent = (): JSX.Element => {
        let planContent: JSX.Element;

        if (this.props.planLoadingStatus === LoadingStatus.NotLoaded) {
            let loadingLabel = "Loading...";
            if (this.props.plan && this.props.plan.name) {
                const suffix = this.props.plan.name.toLowerCase().endsWith("plan") ? "..." : " plan...";
                loadingLabel = `Loading ${this.props.plan.name}${suffix}`;
            }

            planContent = <Spinner className="plan-spinner" label={loadingLabel} size={SpinnerSize.large} />;
        } else {
            PortfolioTelemetry.getInstance().TrackPlanOpened(this.props.plan.id, this.props.planTelemetry);
            planContent = <ConnectedPlanTimeline />;
        }

        return (
            <div className="plan-content">
                {this._renderErrorMessageCard()}
                {planContent}
            </div>
        );
    };

    private _renderErrorMessageCard = (): JSX.Element => {
        if (this.props.exceptionMessage) {
            if (this.props.exceptionMessage.includes("VS403496")) {
                const helpLink = "https://go.microsoft.com/fwlink/?LinkId=786441";
                const errorMessage =
                    "This plan includes projects that you do not have access to. Update your permissions to view this plan. More information can be found here: ";

                return (
                    <MessageCard
                        className="flex-self-stretch exception-message-card"
                        severity={MessageCardSeverity.Error}
                        onDismiss={this.props.dismissErrorMessageCard}
                    >
                        {errorMessage}
                        <Link href={helpLink} target="_blank">
                            {helpLink}
                        </Link>
                    </MessageCard>
                );
            } else {
                return (
                    <MessageCard
                        className="flex-self-stretch exception-message-card"
                        severity={MessageCardSeverity.Error}
                        onDismiss={this.props.dismissErrorMessageCard}
                    >
                        {this.props.exceptionMessage}
                    </MessageCard>
                );
            }
        }
    };

    private _renderAddItemPanel = (): JSX.Element => {
        if (this.props.addItemPanelOpen || this.props.isNewPlanExperience) {
            return (
                <AddItemPanel
                    planId={this.props.plan.id}
                    epicsInPlan={this.props.epicIds}
                    onCloseAddItemPanel={this.props.onCloseAddItemPanel}
                    onAddItems={this.props.onAddItems}
                />
            );
        }
    };

    private _renderItemDetailsDialog = (): JSX.Element => {
        if (this.props.selectedItem) {
            return (
                <DetailsDialog
                    key={Date.now()} // TODO: Is there a better way to reset the state?
                    id={this.props.selectedItem.id}
                    title={this.props.selectedItem.title}
                    startDate={this.props.selectedItem.start_time}
                    endDate={this.props.selectedItem.end_time}
                    hidden={this.props.setDatesDialogHidden}
                    save={(id, startDate, endDate) => {
                        this.props.onUpdateStartDate(id, startDate);
                        this.props.onUpdateEndDate(id, endDate);
                    }}
                    close={() => {
                        this.props.onToggleSetDatesDialogHidden(true);
                    }}
                />
            );
        }
    };

    private _renderPlanSettingsPanel = (): JSX.Element => {
        if (this.props.planSettingsPanelOpen) {
            return (
                <PlanSettingsPanel
                    selectedItem={this.props.selectedItem}
                    progressTrackingCriteria={this.props.progressTrackingCriteria}
                    onProgressTrackingCriteriaChanged={this.props.onToggleProgressTrackingCriteria}
                    onClosePlanSettingsPanel={() => {
                        this.props.onTogglePlanSettingsPanelOpen(false);
                    }}
                />
            );
        }
    };

    private _renderDeletePlanDialog = (): JSX.Element => {
        if (!this.props.deletePlanDialogHidden) {
            return (
                <DeletePlanDialog
                    onDismiss={() => this.props.toggleDeletePlanDialogHidden(true)}
                    onDeleteClicked={this._deletePlanButtonClicked}
                />
            );
        }
    };

    private _backButtonClicked = (): void => {
        this.props.toggleSelectedPlanId(undefined);
        this.props.resetPlanState();
    };

    private _deletePlanButtonClicked = (): void => {
        this.props.deletePlan(this.props.plan.id);
        this.props.toggleDeletePlanDialogHidden(true);
        this.props.resetPlanState();
    };

    private _onRemoveSelectedEpicClick = (): void => {
        this.props.onRemoveSelectedItem({
            planId: this.props.plan.id,
            itemIdToRemove: this.props.selectedItem.id
        });
    };

    private _settingsButtonClicked = (): void => {
        this.props.onTogglePlanSettingsPanelOpen(true);
    };
}

function mapStateToProps(state: IPortfolioPlanningState): IPlanPageMappedProps {
    return {
        plan: getSelectedPlanMetadata(state),
        projectNames: getProjectNames(state),
        teamNames: getTeamNames(state),
        epicIds: getEpicIds(state.epicTimelineState),
        selectedItem: getSelectedItem(state.epicTimelineState),
        progressTrackingCriteria: state.epicTimelineState.progressTrackingCriteria,
        addItemPanelOpen: state.epicTimelineState.addItemsPanelOpen,
        setDatesDialogHidden: state.epicTimelineState.setDatesDialogHidden,
        planSettingsPanelOpen: state.epicTimelineState.planSettingsPanelOpen,
        exceptionMessage: state.epicTimelineState.exceptionMessage,
        planLoadingStatus: state.epicTimelineState.planLoadingStatus,
        isNewPlanExperience: state.epicTimelineState.isNewPlanExperience,
        deletePlanDialogHidden: state.epicTimelineState.deletePlanDialogHidden,
        planTelemetry: getPlanExtendedTelemetry(state.epicTimelineState)
    };
}

const Actions = {
    deletePlan: PlanDirectoryActions.deletePlan,
    toggleSelectedPlanId: PlanDirectoryActions.toggleSelectedPlanId,
    resetPlanState: EpicTimelineActions.resetPlanState,
    onOpenAddItemPanel: EpicTimelineActions.openAddItemPanel,
    onRemoveSelectedItem: EpicTimelineActions.removeItems,
    onToggleProgressTrackingCriteria: EpicTimelineActions.toggleProgressTrackingCriteria,
    onCloseAddItemPanel: EpicTimelineActions.closeAddItemPanel,
    onAddItems: EpicTimelineActions.addItems,
    onToggleSetDatesDialogHidden: EpicTimelineActions.toggleItemDetailsDialogHidden,
    onUpdateStartDate: EpicTimelineActions.updateStartDate,
    onUpdateEndDate: EpicTimelineActions.updateEndDate,
    onTogglePlanSettingsPanelOpen: EpicTimelineActions.togglePlanSettingsPanelOpen,
    toggleDeletePlanDialogHidden: EpicTimelineActions.toggleDeletePlanDialogHidden,
    dismissErrorMessageCard: EpicTimelineActions.dismissErrorMessageCard
};

export const ConnectedPlanPage = connect(
    mapStateToProps,
    Actions
)(PlanPage);
