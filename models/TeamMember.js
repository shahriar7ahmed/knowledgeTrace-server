// TeamMember model for project team management
class TeamMember {
    constructor(data = {}) {
        this._id = data._id || data.id || null;
        this.projectId = data.projectId; // Reference to Project
        this.userId = data.userId; // Firebase UID of team member
        this.role = data.role || 'member'; // 'leader' | 'member'
        this.contribution = data.contribution || ''; // Description of member's contribution
        this.status = data.status || 'active'; // 'invited' | 'active' | 'left'
        this.joinedAt = data.joinedAt || new Date();
        this.createdAt = data.createdAt || new Date();
    }

    /**
     * Accept invitation to join team
     */
    acceptInvitation() {
        this.status = 'active';
        this.joinedAt = new Date();
    }

    /**
     * Leave the team
     */
    leave() {
        this.status = 'left';
    }

    /**
     * Check if member is team leader
     * @returns {boolean}
     */
    isLeader() {
        return this.role === 'leader';
    }

    toJSON() {
        return {
            _id: this._id,
            projectId: this.projectId,
            userId: this.userId,
            role: this.role,
            contribution: this.contribution,
            status: this.status,
            joinedAt: this.joinedAt,
            createdAt: this.createdAt,
        };
    }
}

module.exports = TeamMember;
