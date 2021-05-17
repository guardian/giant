import {
    EuiCollapsibleNav,
    EuiCollapsibleNavGroup,
    EuiFlexItem,
    EuiHeaderSectionItemButton,
    EuiHorizontalRule,
    EuiIcon,
    EuiListGroupItem,
    EuiPinnableListGroup,
    EuiPinnableListGroupItemProps,
    EuiShowFor
} from '@elastic/eui';
import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { WorkspaceMetadata } from '../types/Workspaces';
import history from '../util/history';
import { getWorkspacesMetadata } from '../actions/workspaces/getWorkspacesMetadata';
import { headerHeight } from './displayConstants';
import { useDispatch } from 'react-redux';

const TopLinks: EuiPinnableListGroupItemProps[] = [
    {
        label: 'Home',
        iconType: 'home',
        isActive: true,
        'aria-current': true,
        onClick: () => history.push('/'),
        pinnable: false,
    },
];

type Props = {
    workspacesMetadata: WorkspaceMetadata[]
}

export const GiantEuiLeftHandNav = ({ workspacesMetadata }: Props) => {
    const dispatch = useDispatch();

    const [navIsOpen, setNavIsOpen] = useState(
        JSON.parse(String(localStorage.getItem('navIsDocked'))) || false
    );
    const [navIsDocked, setNavIsDocked] = useState(
        JSON.parse(String(localStorage.getItem('navIsDocked'))) || false
    );

    useEffect(() => {
        if (navIsOpen) {
            dispatch(getWorkspacesMetadata());
        }
    }, [navIsOpen, dispatch]);

    /**
     * Accordion toggling
     */
    const [openGroups, setOpenGroups] = useState(
        JSON.parse(String(localStorage.getItem('openNavGroups'))) || [
            'Kibana',
            'Workspaces',
        ]
    );

    // Save which groups are open and which are not with state and local store
    const toggleAccordion = (isOpen: boolean, title?: string) => {
        if (!title) return;
        const itExists = openGroups.includes(title);
        if (isOpen) {
            if (itExists) return;
            openGroups.push(title);
        } else {
            const index = openGroups.indexOf(title);
            if (index > -1) {
                openGroups.splice(index, 1);
            }
        }
        setOpenGroups([...openGroups]);
        localStorage.setItem('openNavGroups', JSON.stringify(openGroups));
    };

    /**
     * Pinning
     */
    const [pinnedItems, setPinnedItems] = useState<
        EuiPinnableListGroupItemProps[]
        >(JSON.parse(String(localStorage.getItem('pinnedItems'))) || []);

    const addPin = (item: any) => {
        if (!item || _.find(pinnedItems, { label: item.label })) {
            return;
        }
        item.pinned = true;
        const newPinnedItems = pinnedItems ? pinnedItems.concat(item) : [item];
        setPinnedItems(newPinnedItems);
        localStorage.setItem('pinnedItems', JSON.stringify(newPinnedItems));
    };

    const removePin = (item: any) => {
        const pinIndex = _.findIndex(pinnedItems, { label: item.label });
        if (pinIndex > -1) {
            item.pinned = false;
            const newPinnedItems = pinnedItems;
            newPinnedItems.splice(pinIndex, 1);
            setPinnedItems([...newPinnedItems]);
            localStorage.setItem('pinnedItems', JSON.stringify(newPinnedItems));
        }
    };

    function workspacesToLinks(workspaces: WorkspaceMetadata[]): EuiPinnableListGroupItemProps[] {
        return workspaces.map(workspace => ({
            label: workspace.name,
            onClick: () => {
                history.push(`/workspaces/${workspace.id}`);
                setNavIsOpen(false);
            }
        }))
    }


    function alterLinksWithCurrentState(
        links: EuiPinnableListGroupItemProps[],
        showPinned = false
    ): EuiPinnableListGroupItemProps[] {
        return links.map(link => {
            const { pinned, ...rest } = link;
            return {
                pinned: showPinned ? pinned : false,
                ...rest,
            };
        });
    }

    function addLinkNameToPinTitle(listItem: EuiPinnableListGroupItemProps) {
        return `Pin ${listItem.label} to top`;
    }

    function addLinkNameToUnpinTitle(listItem: EuiPinnableListGroupItemProps) {
        return `Unpin ${listItem.label}`;
    }

    const collapsibleNav = (
        <EuiCollapsibleNav
            id="guideCollapsibleNavAllExampleNav"
            style={{top: headerHeight, height: `calc(100% - ${headerHeight})`}}
            aria-label="Main navigation"
            isOpen={navIsOpen}
            isDocked={navIsDocked}
            button={
                <EuiHeaderSectionItemButton
                    aria-label="Toggle main navigation"
                    onClick={() => setNavIsOpen(!navIsOpen)}>
                    <EuiIcon type={'menu'} size="m" aria-hidden="true" />
                </EuiHeaderSectionItemButton>
            }
            onClose={() => setNavIsOpen(false)}>
            {/* Shaded pinned section always with a home item */}
            <EuiFlexItem grow={false} style={{ flexShrink: 0 }}>
                <EuiCollapsibleNavGroup
                    background="light"
                    className="eui-yScroll"
                    style={{ maxHeight: '40vh' }}>
                    <EuiPinnableListGroup
                        aria-label="Pinned links" // A11y : Since this group doesn't have a visible `title` it should be provided an accessible description
                        listItems={alterLinksWithCurrentState(TopLinks).concat(
                            alterLinksWithCurrentState(pinnedItems, true)
                        )}
                        unpinTitle={addLinkNameToUnpinTitle}
                        onPinClick={removePin}
                        maxWidth="none"
                        color="text"
                        gutterSize="none"
                        size="s"
                    />
                </EuiCollapsibleNavGroup>
            </EuiFlexItem>

            <EuiHorizontalRule margin="none" />

            {/* BOTTOM */}
            <EuiFlexItem className="eui-yScroll">
                {/* Workspaces section */}
                <EuiCollapsibleNavGroup
                    title="Workspaces"
                    iconType="training"
                    isCollapsible={true}
                    initialIsOpen={openGroups.includes('Workspaces')}
                    onToggle={(isOpen: boolean) => toggleAccordion(isOpen, 'Workspaces')}>
                    <EuiPinnableListGroup
                        aria-label="Workspaces" // A11y : EuiCollapsibleNavGroup can't correctly pass the `title` as the `aria-label` to the right HTML element, so it must be added manually
                        listItems={alterLinksWithCurrentState(workspacesToLinks(workspacesMetadata))}
                        pinTitle={addLinkNameToPinTitle}
                        onPinClick={addPin}
                        maxWidth="none"
                        color="subdued"
                        gutterSize="none"
                        size="s"
                    />
                </EuiCollapsibleNavGroup>

                {/* Docking button only for larger screens that can support it*/}
                <EuiShowFor sizes={['l', 'xl']}>
                    <EuiCollapsibleNavGroup>
                        <EuiListGroupItem
                            size="xs"
                            color="subdued"
                            label={`${navIsDocked ? 'Undock' : 'Dock'} navigation`}
                            onClick={() => {
                                setNavIsDocked(!navIsDocked);
                                localStorage.setItem(
                                    'navIsDocked',
                                    JSON.stringify(!navIsDocked)
                                );
                            }}
                            iconType={navIsDocked ? 'lock' : 'lockOpen'}
                        />
                    </EuiCollapsibleNavGroup>
                </EuiShowFor>
            </EuiFlexItem>
        </EuiCollapsibleNav>
    );

    return collapsibleNav;
};
