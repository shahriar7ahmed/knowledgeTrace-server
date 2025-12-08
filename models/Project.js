// Project model/schema for MongoDB
class Project {
  constructor(data) {
    this._id = data._id || data.id || null;
    this.title = data.title;
    this.abstract = data.abstract;
    this.techStack = Array.isArray(data.techStack) ? data.techStack : [];
    this.author = data.author || '';
    this.authorId = data.authorId || ''; // Firebase UID of author
    this.supervisor = data.supervisor || '';
    this.year = data.year || new Date().getFullYear();
    this.githubLink = data.githubLink || '';
    this.pdfUrl = data.pdfUrl || ''; // Cloudinary URL
    this.tags = Array.isArray(data.tags) ? data.tags : [];
    this.status = data.status || 'pending'; // pending, approved, rejected
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    
    // Engagement fields
    this.likes = Array.isArray(data.likes) ? data.likes : [];
    this.likeCount = data.likeCount !== undefined ? data.likeCount : (data.likes?.length || 0);
    this.comments = Array.isArray(data.comments) ? data.comments : [];
    this.commentCount = data.commentCount !== undefined ? data.commentCount : (data.comments?.length || 0);
    this.views = data.views !== undefined ? data.views : 0;
    this.bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
  }

  toJSON() {
    return {
      _id: this._id,
      title: this.title,
      abstract: this.abstract,
      techStack: this.techStack,
      author: this.author,
      authorId: this.authorId,
      supervisor: this.supervisor,
      year: this.year,
      githubLink: this.githubLink,
      pdfUrl: this.pdfUrl,
      tags: this.tags,
      status: this.status,
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

