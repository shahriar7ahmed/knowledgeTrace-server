// User model/schema for MongoDB
class User {
  constructor(data = {}) {
    this.uid = data.uid || ''; // Firebase UID
    this.email = data.email || '';
    this.name = data.name || data.displayName || '';
    this.displayName = data.displayName || data.name || '';
    this.photoURL = data.photoURL || '';
    this.department = data.department || '';
    this.year = data.year || '';
    this.skills = data.skills || [];
    this.github = data.github || '';
    this.linkedin = data.linkedin || '';
    this.isAdmin = data.isAdmin || false;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  toJSON() {
    return {
      uid: this.uid,
      email: this.email,
      name: this.name,
      displayName: this.displayName,
      photoURL: this.photoURL,
      department: this.department,
      year: this.year,
      skills: Array.isArray(this.skills) ? this.skills : (this.skills ? this.skills.split(',').map(s => s.trim()) : []),
      github: this.github,
      linkedin: this.linkedin,
      isAdmin: this.isAdmin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = User;

