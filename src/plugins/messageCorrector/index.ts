/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";

const hasTimestampRegex = /-# \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
const logger = new Logger("MessageCorrector");

const settings = definePluginSettings({
    allowReordering: {
        description: "Let this plugin reorder messages based on when the message reached Discord's servers. This is kinda the entire point of the plugin.",
        type: OptionType.BOOLEAN,
        default: true,
    },
    debug: {
        description: "Enable this plugin in debug mode. This will show timestamps in each message, and will add extra logs to the console.",
        type: OptionType.BOOLEAN,
        default: false,
    },
});

export default definePlugin({
    name: "MessageCorrector",
    description: "Corrects the order of messages in the chat, based on when the message reached Discord's servers.",
    settings: settings,
    authors: [Devs.Calebh101],

    start() {
        logger.log("Started in " + (settings.store.debug ? "debug" : "standard") + "mode");
    },

    stop() {
        if (settings.store.debug) logger.log("Stopped");
    },

    patches: [
        {
            find: "messageDisplayCompact:C,channelStream:S",
            replacement: {
                match: /ee=\(0,(\w+)\.Ay\)\(\{messages:(\w+)/,
                replace: "ee=(0,$1.Ay)({messages:Vencord.Plugins.plugins.MessageCorrector.reorder($2)",
            },
        },
    ],

    reorder(messages: any) {
        try {
            if (settings.store.debug) logger.log("Reordering messages...", typeof messages, messages);

            if (settings.store.debug) {
                for (var x of messages._array) {
                    // Skip if a timestamp is already attached.
                    if (hasTimestampRegex.test(x.content)) continue;

                    // Add timestamps to the messages in debug mode, so we know if things are ordered correctly.
                    x.content += "\n-# " + new Date(x.timestamp).toISOString();
                }
            }

            if (settings.store.allowReordering) {
                // Sort everything by their timestamp.
                // The timestamp is when the message reached Discord's servers.

                messages._array = [...messages._array].sort((a, b) => {
                    const tA = new Date(a.timestamp).getTime();
                    const tB = new Date(b.timestamp).getTime();
                    return tA - tB;
                });
            }

            return messages;
        } catch (e) {
            logger.warn("Unable to reorder messages", e);
        }
    }
});
