// ProjectComment model for phase-specific feedback
class ProjectComment {
    constructor(data = {}) {
        this._id = data._id || data.id || null;
        this.projectId = data.projectId; // Reference to Project
        this.userId = data.userId; // Firebase UID of commenter
        this.phase = data.phase; // 'proposal' | 'supervisor_review' | 'mid_defense' | 'final_submission'
        this.comment = data.comment;
        this.isResolved = data.isResolved || false;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    /**
     * Mark comment as resolved
     */
    resolve() {
        this.isResolved = true;
        this.updatedAt = new Date();
    }

    /**
     * Reopen resolved comment
     */
    reopen() {
        this.isResolved = false;
        this.updatedAt = new Date();
    }

    toJSON() {
        return {
            _id: this._id,
            projectId: this.projectId,
            userId: this.userId,
            phase: this.phase,
            comment: this.comment,
            isResolved: this.isResolved,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}

module.exports = ProjectComment;
