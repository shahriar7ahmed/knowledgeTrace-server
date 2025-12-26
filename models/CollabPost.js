// CollabPost model/schema for MongoDB
class CollabPost {
    constructor(data) {
        this._id = data._id || data.id || null;
        this.title = data.title;
        this.description = data.description;
        this.owner = data.owner || ''; // Firebase UID or User reference
        this.skillsRequired = Array.isArray(data.skillsRequired) ? data.skillsRequired : [];
        this.projectType = data.projectType || 'Thesis'; // Thesis, Semester Project, Hackathon
        this.status = data.status || 'OPEN'; // OPEN or CLOSED
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    toJSON() {
        return {
            _id: this._id,
            title: this.title,
            description: this.description,
            owner: this.owner,
            skillsRequired: this.skillsRequired,
            projectType: this.projectType,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}

module.exports = CollabPost;
