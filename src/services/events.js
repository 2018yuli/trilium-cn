const log = require('./log');

const NOTE_TITLE_CHANGED = "NOTE_TITLE_CHANGED";
const ENTER_PROTECTED_SESSION = "ENTER_PROTECTED_SESSION";
const ENTITY_CREATED = "ENTITY_CREATED";
const ENTITY_CHANGED = "ENTITY_CHANGED";
const ENTITY_DELETED = "ENTITY_DELETED";
const ENTITY_SYNCED = "ENTITY_SYNCED";
const CHILD_NOTE_CREATED = "CHILD_NOTE_CREATED";

const eventListeners = {};

/**
 * @param eventTypes - can be either single event or an array of events
 * @param listener
 */
function subscribe(eventTypes, listener) {
    if (!Array.isArray(eventTypes)) {
        eventTypes = [ eventTypes ];
    }

    for (const eventType of eventTypes) {
        eventListeners[eventType] = eventListeners[eventType] || [];
        eventListeners[eventType].push(listener);
    }
}

async function emit(eventType, data) {
    const listeners = eventListeners[eventType];

    if (listeners) {
        for (const listener of listeners) {
            try {
                await listener(data);
            }
            catch (e) {
                log.error("Listener threw error: " + e.stack);
                // we won't stop execution because of listener
            }
        }
    }
}

module.exports = {
    subscribe,
    emit,
    // event types:
    NOTE_TITLE_CHANGED,
    ENTER_PROTECTED_SESSION,
    ENTITY_CREATED,
    ENTITY_CHANGED,
    ENTITY_DELETED,
    ENTITY_SYNCED,
    CHILD_NOTE_CREATED
};