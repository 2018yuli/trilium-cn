export default class SpacedUpdate {
    constructor(updater, updateInterval = 1000) {
        this.updater = updater;
        this.lastUpdated = Date.now();
        this.changed = false;
        this.updateInterval = updateInterval;
    }

    scheduleUpdate() {
        if (!this.changeForbidden) {
            this.changed = true;
            setTimeout(() => this.triggerUpdate());
        }
    }

    async updateNowIfNecessary() {
        if (this.changed) {
            this.changed = false;
            await this.updater();
        }
    }

    triggerUpdate() {
        if (!this.changed) {
            return;
        }

        if (Date.now() - this.lastUpdated > this.updateInterval) {
            this.updater();
            this.lastUpdated = Date.now();
            this.changed = false;
        }
        else {
            // update not triggered but changes are still pending so we need to schedule another check
            this.scheduleUpdate();
        }
    }

    async allowUpdateWithoutChange(callback) {
        this.changeForbidden = true;

        try {
            await callback();
        }
        finally {
            this.changeForbidden = false;
        }
    }
}
