// SupervisorRequest model for student-supervisor collaboration requests
class SupervisorRequest {
    constructor(data = {}) {
        this._id = data._id || data.id || null;
        this.studentId = data.studentId; // Firebase UID of requesting student
        this.supervisorId = data.supervisorId; // Firebase UID of supervisor
        this.projectId = data.projectId || null; // Optional: existing project ID if requesting for specific project
        this.message = data.message; // Student's request message
        this.status = data.status || 'pending'; // 'pending' | 'approved' | 'rejected'
        this.supervisorResponse = data.supervisorResponse || ''; // Optional feedback from supervisor
        this.createdAt = data.createdAt || new Date();
        this.respondedAt = data.respondedAt || null;
    }

    /**
     * Approve the request
     * @param {string} response - Optional supervisor message
     */
    approve(response = '') {
        this.status = 'approved';
        this.supervisorResponse = response;
        this.respondedAt = new Date();
    }

    /**
     * Reject the request
     * @param {string} response - Rejection reason
     */
    reject(response) {
        this.status = 'rejected';
        this.supervisorResponse = response;
        this.respondedAt = new Date();
    }

    /**
     * Check if request is still pending
     * @returns {boolean}
     */
    isPending() {
        return this.status === 'pending';
    }

    toJSON() {
        return {
            _id: this._id,
            studentId: this.studentId,
            supervisorId: this.supervisorId,
            projectId: this.projectId,
            message: this.message,
            status: this.status,
            supervisorResponse: this.supervisorResponse,
            createdAt: this.createdAt,
            respondedAt: this.respondedAt,
        };
    }
}

module.exports = SupervisorRequest;
