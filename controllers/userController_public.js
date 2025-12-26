/**
 * Get public user profile by ID (no authentication required)
 * GET /api/users/:id
 */
exports.getPublicUserProfile = async (req, res) => {
    try {
        const usersCollection = await getUsersCollection();
        const projectsCollection = await getProjectsCollection();
        const { id } = req.params;

        // Find user by uid
        const user = await usersCollection.findOne({ uid: id });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get user's approved projects
        const projects = await projectsCollection
            .find({ authorId: id, status: 'approved' })
            .sort({ createdAt: -1 })
            .toArray();

        // Sanitize user data (exclude sensitive information)
        const publicUserData = {
            uid: user.uid,
            name: user.name || user.displayName,
            displayName: user.displayName || user.name,
            photoURL: user.photoURL,
            department: user.department,
            year: user.year,
            skills: user.skills || [],
            bio: user.bio,
            headline: user.headline,
            socialLinks: user.socialLinks || {
                github: user.github,
                linkedin: user.linkedin,
                website: user.website
            },
            github: user.github, // Keep for backward compatibility
            linkedin: user.linkedin, // Keep for backward compatibility
            createdAt: user.createdAt,
            // Explicitly exclude email, isAdmin, etc.
        };

        res.json({
            success: true,
            user: publicUserData,
            projects: projects || [],
        });
    } catch (error) {
        console.error('Error fetching public user profile:', error);
        res.status(500).json({ message: 'Error fetching user profile' });
    }
};
