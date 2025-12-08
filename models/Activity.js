// Activity model for tracking user activity
class Activity {
  constructor(data = {}) {
    this._id = data._id || null;
    this.userId = data.userId || ''; // Firebase UID
    this.recentProjects = Array.isArray(data.recentProjects) ? data.recentProjects : [];
    this.bookmarkedProjects = Array.isArray(data.bookmarkedProjects) ? data.bookmarkedProjects : [];
    this.lastActivity = data.lastActivity || new Date();
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  toJSON() {
    return {
      _id: this._id,
      userId: this.userId,
      recentProjects: this.recentProjects,
      bookmarkedProjects: this.bookmarkedProjects,
      lastActivity: this.lastActivity,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = Activity;

