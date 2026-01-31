/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByProps } from "@webpack";
import { NotificationSettingsStore } from "@webpack/common";

const enabled: boolean = true;
const debug: boolean = false;
const defaultNumber: number = 0;
const logger = new Logger("NotificationBadgeControl");

enum ShowPlaceholder {
    never,
    default,
    always,
}

enum WhatAreNotifs {
    mentions,
    other,
    all,
}

const settings = definePluginSettings({
    showPlaceholder: {
        description: "When to show the placeholder (the period). The default behavior is to show it when there are unread messages but no notifications. Note that this plugin technically just replicates the default behavior; we don't call back the actual original function.",
        type: OptionType.SELECT,
        options: [
            { label: "Never", value: ShowPlaceholder.never },
            { label: "Default", value: ShowPlaceholder.default, default: true },
            { label: "Always", value: ShowPlaceholder.always },
        ],
    },
    showCountBadgeAtOrAbove: {
        description: "How many notifications need to be present to show a number as the badge. This must be an integer that is positive, or set this to zero to disable.",
        type: OptionType.NUMBER,
        default: 1,
    },
    whatAreNotifs: {
        description: "What counts as a notification? There are two properties passed to the logic function so I thought I'd let you decide. For more details, see the plugin's documentation.",
        type: OptionType.SELECT,
        options: [
            { label: "Just Mentions", value: WhatAreNotifs.mentions },
            { label: "Just 'Other'", value: WhatAreNotifs.other },
            { label: "Both", value: WhatAreNotifs.all, default: true },
        ],
    },
    customNumber: {
        description: "A specific number to return from the logic. This will override the above settings. For reference, -1 means show the placeholder, 0 means don't show a badge, and above 0 means show a badge with that count. Set this to -2 or below to disable. Note that leaving this blank will make it default to 0, which is likely not what you want.",
        type: OptionType.NUMBER,
        default: -2,
    },
    customLogic: {
        description: "See the plugin's documentation.",
        type: OptionType.STRING,
        default: "",
    },
});

function isNotif(type: WhatAreNotifs): boolean {
    const setting = settings.store.whatAreNotifs;
    if (type === WhatAreNotifs.all || setting === WhatAreNotifs.all) return true;
    return type === setting;
}

function check(): boolean {
    const plugin = Vencord.Plugins.plugins.NotificationBadgeControl;
    if (plugin && plugin.settings) return true;
    return false;
}

export default definePlugin({
    name: "NotificationBadgeControl",
    description: "Manipulate the notification badge to not be annoying.",
    authors: [Devs.Calebh101],
    settings: settings,

    patches: [
        {
            find: ".getDisableUnreadBadge(),",
            replacement: {
                match: /0===(\i)&&(\i)&&!(\i)&&\(\i=-1\)/,
                replace: "$1=$self.logic($1)",
            },
            predicate: () => enabled,
        },
    ],

    start() {
        if (enabled && debug) logger.log("Started in " + (debug ? "debug" : "standard") + " mode");
    },

    stop() {
        if (enabled && debug) logger.log("Stopped");
    },

    logic(totalNotifs: number): number {
        const module = findByProps("getTotalMentionCount");
        if (!module) return 0;

        const mentions: number = module.getTotalMentionCount();
        const hasUnread: boolean = module.hasAnyUnread();
        const disabled: boolean = NotificationSettingsStore.getDisableUnreadBadge();
        const other = totalNotifs - mentions;

        const checked = check();
        if (debug) logger.log("Received badge number logic call", checked, mentions, other, hasUnread, disabled, settings.store);
        if (!checked) return defaultNumber;
        const custom = settings.store.customLogic;

        if (custom && custom.trim().length > 0) {
            try {
                const f = new Function(
                    "mentions", "other", "hasUnread", "disabled",
                    `return (${custom})(mentions, other, hasUnread, disabled);`,
                ) as (mentions: number, other: number, hasUnread: boolean, disabled: boolean) => number;

                const result = f(mentions, other, hasUnread, disabled);

                if (typeof result === "number" && !isNaN(result)) {
                    return Math.trunc(result);
                } else {
                    logger.warn("Custom logic returned invalid value, falling back to default", result);
                }
            } catch (e) {
                logger.error("Failed to execute custom badge logic, falling back to default", e);
            }
        }

        const customOverride = Math.trunc(settings.store.customNumber ?? -2);
        if (customOverride >= -1) return customOverride;

        const placeholder = settings.store.showPlaceholder;
        if (placeholder === ShowPlaceholder.always) return -1;

        var showCountBadgeAtOrAbove = Math.trunc(settings.store.showCountBadgeAtOrAbove ?? 1);
        if (showCountBadgeAtOrAbove < 0) showCountBadgeAtOrAbove = 1;
        const notifs = (isNotif(WhatAreNotifs.mentions) ? mentions : 0) + (isNotif(WhatAreNotifs.other) ? other : 0);

        if (showCountBadgeAtOrAbove > 0 && notifs >= showCountBadgeAtOrAbove) {
            return notifs;
        } else {
            if (placeholder === ShowPlaceholder.never) return 0;
            if (hasUnread) return -1;
            return 0;
        }
    }
});
