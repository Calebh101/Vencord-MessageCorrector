/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// I took some of this code from the PlatformIndicators and TypingIndicator plugins.

import { addProfileBadge, BadgePosition, BadgeUserArgs, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { addMemberListDecorator, removeMemberListDecorator } from "@api/MemberListDecorators";
import { addMessageDecoration, removeMessageDecoration } from "@api/MessageDecorations";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, User } from "@vencord/discord-types";
import { ChannelStore, GuildMemberStore, React, SelectedChannelStore, SelectedGuildStore, Tooltip, UserStore } from "@webpack/common";

const enabled: boolean = true;
const logger = new Logger("MemberLeftBadge");

const settings = definePluginSettings({
    allowBots: {
        description: "Also show the badge for bots and threads/posts started by bots who have been booted.",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
    },
    showInMemberList: {
        description: "Show the badge in the server member list.",
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: true,
        hidden: true, // Figured this was redundant
    },
    showInProfile: {
        description: "Show the badge in user profiles.",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
    },
    showInMessages: {
        description: "Show the badge in messages.",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
    },
    showForThreads: {
        description: "Show a badge on threads created by users who left the server. This includes forum posts.",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
    },
    renderOnAllApplicable: {
        description: "Render this badge on all applicable threads in the channel list. This may absolutely decimate performance (see the setting below), so it's off by default.",
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true, // Very buggy
    },
    refreshConstantly: {
        description: "Due to either Discord being dumb, or me being dumb, in order for this to work correctly, each badge in the channel list has to refresh constantly. On lower-end hardware, it might be preferable to disable this, although it might be a bit buggy.",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
    },
});

function MemberLeftChannelBadge({ channelId, guildId, channel, creator }: { channelId: string, guildId: string, channel: Channel, creator: User; }) {
    const memberExists = !!GuildMemberStore.getMember(guildId, creator.id);
    if (memberExists) return null; // OP is still here

    return (
        <span className="vc-user-left" style={{ display: "flex", alignItems: "center" }}>
            <ExitIcon small={false} tooltip="OP left" />
        </span>
    );
}

function Icon(path: string) {
    return ({ small, tooltip }: { small: boolean; tooltip: string; }) => (
        <Tooltip text={tooltip}>
            {tooltipProps => (
                <svg
                    {...tooltipProps}
                    height={small ? 20 : 24}
                    width={small ? 20 : 24}
                    viewBox={"0 0 24 24"}
                >
                    <path d={path} fill="hsl(357.692deg 67.826% 54.902%)" />
                </svg>
            )}
        </Tooltip>
    );
}

// https://raw.githubusercontent.com/google/material-design-icons/master/src/action/exit_to_app/materialicons/24px.svg
const ExitIcon = Icon("M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z");

function getBadges({ userId }: BadgeUserArgs): ProfileBadge[] {
    const user = UserStore.getUser(userId);
    if (!user) return [];
    if (!settings.store.allowBots && user.bot) return [];

    const guildId = SelectedGuildStore.getGuildId();
    if (!guildId || GuildMemberStore.getMember(guildId, user.id)) return [];

    return [{
        key: "vc-user-left",
        component: (props: BadgeUserArgs & { small?: boolean; }) => <ExitIcon small={false} tooltip="User left" />,
    }];
}

const badge: ProfileBadge = {
    getBadges,
    position: BadgePosition.END,
};

const Indicator = ({ user, small = false }: { user: User; small?: boolean; }) => {
    if (!settings.store.allowBots && user.bot) return null;
    const guildId = SelectedGuildStore.getGuildId();
    if (!guildId || GuildMemberStore.getMember(guildId, user.id)) return null;

    return (
        <span className="vc-user-left">
            <ExitIcon
                small={small}
                tooltip="User left"
            />
        </span>
    );
};

const indicatorLocations = {
    list: {
        setting: "showInMemberList",
        title: "member list",
        description: "In the member list",
        onEnable: () => addMemberListDecorator("user-left", ({ user }) =>
            user && (settings.store.allowBots || !user.bot) ? <Indicator user={user} small={true} /> : null
        ),
        onDisable: () => removeMemberListDecorator("user-left")
    },
    badges: {
        setting: "showInProfile",
        title: "profile",
        description: "In user profiles, as badges",
        onEnable: () => addProfileBadge(badge),
        onDisable: () => removeProfileBadge(badge)
    },
    messages: {
        setting: "showInMessages",
        title: "messages",
        description: "Inside messages",
        onEnable: () => addMessageDecoration("user-left", props => {
            const user = props.message?.author;
            return user && (settings.store.allowBots || !user.bot) ? <Indicator user={props.message?.author} /> : null;
        }),
        onDisable: () => removeMessageDecoration("user-left")
    }
};

export default definePlugin({
    name: "MemberLeftBadge",
    description: "Show a badge next to members who left the current guild, or the threads/posts they created.",
    authors: [Devs.Calebh101],
    settings: settings,

    start() {
        if (!enabled) return;
        logger.debug("Started");

        Object.entries(indicatorLocations).forEach(([key, value]) => {
            if (settings.store[value.setting] === true) {
                logger.debug("Starting indicator location " + value.title);
                value.onEnable();
            }
        });
    },

    stop() {
        if (!enabled) return;

        Object.entries(indicatorLocations).forEach(([_, value]) => {
            logger.debug("Stopping indicator location " + value.title);
            value.onDisable();
        });
    },

    patches: [
        {
            find: "M0 15H2c0 1.6569",
            replacement: {
                match: /mentionsCount:\i.+?null(?<=channel:(\i).+?)/,
                replace: "$&,$self.render($1.id,$1.getGuildId())",
            },
            predicate: () => enabled && settings.store.showForThreads,
        },
    ],

    render: (channelId: string, guildId: string) => {
        if (!settings.store.renderOnAllApplicable && SelectedChannelStore.getChannelId() !== channelId) return null;

        const channel = ChannelStore.getChannel(channelId);
        if (!channel) return null;
        const creatorId = channel.ownerId;

        const memberExists = !!GuildMemberStore.getMember(guildId, creatorId);
        if (memberExists) return null; // OP is still here
        const creator = UserStore.getUser(creatorId);

        if (!creator) return null; // Invalid ID?
        if (!settings.store.allowBots && creator.bot) return null;

        const Wrapper = () => {
            const [tick, setTick] = React.useState(0);

            if (settings.store.refreshConstantly) {
                React.useEffect(() => {
                    const interval = setInterval(() => setTick(t => t + 1), 500);
                    return () => clearInterval(interval);
                }, []);
            }

            return (
                <ErrorBoundary noop>
                    <MemberLeftChannelBadge channelId={channelId} guildId={guildId} creator={creator} channel={channel} />
                </ErrorBoundary>
            );
        };

        return <Wrapper key={channelId + guildId} />;
    },
});
