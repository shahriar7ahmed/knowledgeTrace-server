// ProjectMilestone model for tracking workflow phases
class ProjectMilestone {
    constructor(data = {}) {
        this._id = data._id || data.id || null;
        this.projectId = data.projectId; // Reference to Project
        this.phase = data.phase; // 'proposal' | 'supervisor_review' | 'mid_defense' | 'final_submission'
        this.status = data.status || 'pending'; // 'pending' | 'in_progress' | 'completed' | 'rejected'
        this.deadline = data.deadline || null; // Optional deadline
        this.completedAt = data.completedAt || null;
        this.reviewerId = data.reviewerId || null; // Supervisor who reviewed
        this.feedback = data.feedback || ''; // Supervisor feedback
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    /**
     * Mark milestone as completed
     * @param {string} reviewerId - UID of reviewer
     * @param {string} feedback - Optional feedback
     */
    complete(reviewerId, feedback = '') {
        this.status = 'completed';
        this.completedAt = new Date();
        this.reviewerId = reviewerId;
        this.feedback = feedback;
        this.updatedAt = new Date();
    }

    /**
     * Reject milestone
     * @param {string} reviewerId - UID of reviewer
     * @param {string} feedback - Rejection reason
     */
    reject(reviewerId, feedback) {
        this.status = 'rejected';
        this.reviewerId = reviewerId;
        this.feedback = feedback;
        this.updatedAt = new Date();
    }

    toJSON() {
        return {
            _id: this._id,
            projectId: this.projectId,
            phase: this.phase,
            status: this.status,
            deadline: this.deadline,
            completedAt: this.completedAt,
            reviewerId: this.reviewerId,
            feedback: this.feedback,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}

module.exports = ProjectMilestone;
