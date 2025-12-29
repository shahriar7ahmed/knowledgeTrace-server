// Project model/schema for MongoDB with workflow management
class Project {
  constructor(data) {
    this._id = data._id || data.id || null;
    this.title = data.title;
    this.abstract = data.abstract; // For duplicate detection (Module A)
    this.description = data.description || '';
    this.techStack = Array.isArray(data.techStack) ? data.techStack : [];
    this.tags = Array.isArray(data.tags) ? data.tags : [];

    // Team and supervision
    this.author = data.author || ''; // Legacy field
    this.authorId = data.authorId || ''; // Firebase UID of creator
    this.studentIds = Array.isArray(data.studentIds) ? data.studentIds : [data.authorId].filter(Boolean); // All team members
    this.supervisor = data.supervisor || ''; // Supervisor name (legacy)
    this.supervisorId = data.supervisorId || ''; // Firebase UID of supervisor

    // Module C: Team Formation
    this.requiredSkills = Array.isArray(data.requiredSkills) ? data.requiredSkills : [];

    // Module B: Workflow Management
    this.status = data.status || 'draft';
    // Workflow states: draft | pending_proposal | supervisor_review | changes_requested | 
    //                  approved | mid_defense | final_submission | completed | archived

    this.year = data.year || new Date().getFullYear();
    this.department = data.department || '';
    this.githubLink = data.githubLink || '';
    this.pdfUrl = data.pdfUrl || ''; // Cloudinary URL (Module A)
    this.visibility = data.visibility || 'public'; // 'public' | 'private'

    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();

    // Engagement fields (existing features)
    this.likes = Array.isArray(data.likes) ? data.likes : [];
    this.likeCount = data.likeCount !== undefined ? data.likeCount : (data.likes?.length || 0);
    this.comments = Array.isArray(data.comments) ? data.comments : [];
    this.commentCount = data.commentCount !== undefined ? data.commentCount : (data.comments?.length || 0);
    this.views = data.views !== undefined ? data.views : 0;
    this.bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
  }

  /**
   * Check if project is in a specific workflow state
   * @param {string} state - Workflow state to check
   * @returns {boolean}
   */
  isInState(state) {
    return this.status === state;
  }

  /**
   * Get all valid workflow state transitions from current state
   * @returns {string[]} Array of valid next states
   */
  getValidTransitions() {
    const transitions = {
      'draft': ['pending_proposal'],
      'pending_proposal': ['supervisor_review'],
      'supervisor_review': ['approved', 'changes_requested'],
      'changes_requested': ['pending_proposal'],
      'approved': ['mid_defense'],
      'mid_defense': ['final_submission'],
      'final_submission': ['completed'],
      'completed': ['archived']
    };
    return transitions[this.status] || [];
  }

  /**
   * Check if transition to a new state is valid
   * @param {string} newState - Target state
   * @returns {boolean}
   */
  canTransitionTo(newState) {
    return this.getValidTransitions().includes(newState);
  }

  toJSON() {
    return {
      _id: this._id,
      title: this.title,
      abstract: this.abstract,
      description: this.description,
      techStack: this.techStack,
      tags: this.tags,
      author: this.author,
      authorId: this.authorId,
      studentIds: this.studentIds,
      supervisor: this.supervisor,
      supervisorId: this.supervisorId,
      requiredSkills: this.requiredSkills,
      status: this.status,
      year: this.year,
      department: this.department,
      githubLink: this.githubLink,
      pdfUrl: this.pdfUrl,
      visibility: this.visibility,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      likes: this.likes,
      likeCount: this.likeCount,
      comments: this.comments,
      commentCount: this.commentCount,
      views: this.views,
      bookmarks: this.bookmarks,
    };
  }
}

module.exports = Project;


