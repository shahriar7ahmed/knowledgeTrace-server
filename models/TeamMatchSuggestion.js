// TeamMatchSuggestion model for storing skill-based team recommendations
class TeamMatchSuggestion {
    constructor(data = {}) {
        this._id = data._id || data.id || null;
        this.projectId = data.projectId; // Reference to Project
        this.studentId = data.studentId; // Firebase UID of suggested student
        this.matchScore = data.matchScore || 0; // 0-100 percentage match
        this.matchedSkills = Array.isArray(data.matchedSkills) ? data.matchedSkills : [];
        this.missingSkills = Array.isArray(data.missingSkills) ? data.missingSkills : [];
        this.createdAt = data.createdAt || new Date();
    }

    /**
     * Get match level based on score
     * @returns {string} 'best_fit' | 'good_fit' | 'needs_training'
     */
    getMatchLevel() {
        if (this.matchScore >= 70) return 'best_fit';
        if (this.matchScore >= 40) return 'good_fit';
        return 'needs_training';
    }

    toJSON() {
        return {
            _id: this._id,
            projectId: this.projectId,
            studentId: this.studentId,
            matchScore: this.matchScore,
            matchedSkills: this.matchedSkills,
            missingSkills: this.missingSkills,
            matchLevel: this.getMatchLevel(),
            createdAt: this.createdAt,
        };
    }
}

module.exports = TeamMatchSuggestion;
