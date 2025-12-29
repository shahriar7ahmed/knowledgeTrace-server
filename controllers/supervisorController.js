// Supervisor Request Controller
// Handles student-supervisor collaboration requests

const {
    getUsersCollection,
    getProjectsCollection,
    getSupervisorRequestsCollection,
    ObjectId
} = require('../config/database');
const { supervisorRequestSchema, supervisorResponseSchema } = require('../validators/thesisSchemas');
const SupervisorRequest = require('../models/SupervisorRequest');

/**
 * Browse available supervisors with their research areas and projects
 * GET /api/supervisors/browse
 */
const browseSupervisors = async (req, res) => {
    try {
        const { department, researchArea, page = 1, limit = 20 } = req.query;

        const usersCollection = await getUsersCollection();

        // Build filter for supervisors
        const filter = {
            role: 'supervisor'
        };

        if (department) {
            filter.department = department;
        }

        if (researchArea) {
            filter.researchAreas = { $in: [researchArea] };
        }

        // Get supervisors with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const supervisors = await usersCollection
            .find(filter)
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();

        // Get projects for each supervisor
        const projectsCollection = await getProjectsCollection();
        const enrichedSupervisors = await Promise.all(
            supervisors.map(async (supervisor) => {
                const projects = await projectsCollection
                    .find({
                        supervisorId: supervisor.uid,
                        visibility: 'public',
                        status: { $in: ['completed', 'archived'] }
                    })
                    .sort({ year: -1 })
                    .limit(5)
                    .project({ _id: 1, title: 1, year: 1, abstract: 1, tags: 1 })
                    .toArray();

                return {
                    uid: supervisor.uid,
                    name: supervisor.name || supervisor.displayName,
                    email: supervisor.email,
                    department: supervisor.department,
                    researchAreas: supervisor.researchAreas || [],
                    bio: supervisor.bio || '',
                    photoURL: supervisor.photoURL,
                    recentProjects: projects,
                    projectCount: supervisor.supervisedProjects?.length || 0
                };
            })
        );

        const totalCount = await usersCollection.countDocuments(filter);

        res.json({
            success: true,
            supervisors: enrichedSupervisors,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error browsing supervisors:', error);
        res.status(500).json({
            message: 'Error fetching supervisors',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Send collaboration request to supervisor
 * POST /api/supervisors/request
 */
const sendRequest = async (req, res) => {
    try {
        const studentUid = req.user.uid;

        // Validate request body
        const { error, value } = supervisorRequestSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                message: 'Invalid request data',
                errors: error.details.map(d => d.message)
            });
        }

        const { supervisorId, projectId, message } = value;

        // Verify supervisor exists and has supervisor role
        const usersCollection = await getUsersCollection();
        const supervisor = await usersCollection.findOne({ uid: supervisorId });

        if (!supervisor) {
            return res.status(404).json({ message: 'Supervisor not found' });
        }

        if (supervisor.role !== 'supervisor') {
            return res.status(400).json({ message: 'User is not a supervisor' });
        }

        // If projectId is provided, verify project exists and belongs to student
        if (projectId) {
            if (!ObjectId.isValid(projectId)) {
                return res.status(400).json({ message: 'Invalid project ID' });
            }

            const projectsCollection = await getProjectsCollection();
            const project = await projectsCollection.findOne({ _id: new ObjectId(projectId) });

            if (!project) {
                return res.status(404).json({ message: 'Project not found' });
            }

            if (project.authorId !== studentUid) {
                return res.status(403).json({ message: 'Project does not belong to you' });
            }

            // Check if project already has supervisor
            if (project.supervisorId) {
                return res.status(400).json({
                    message: 'Project already has a supervisor assigned'
                });
            }
        }

        // Check for existing pending request
        const requestsCollection = await getSupervisorRequestsCollection();
        const existingRequest = await requestsCollection.findOne({
            studentId: studentUid,
            supervisorId,
            projectId: projectId || null,
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({
                message: 'You already have a pending request to this supervisor for this project'
            });
        }

        // Create new request
        const request = new SupervisorRequest({
            studentId: studentUid,
            supervisorId,
            projectId: projectId || null,
            message,
            createdAt: new Date()
        });

        const result = await requestsCollection.insertOne(request.toJSON());

        // TODO: Send notification to supervisor

        res.json({
            success: true,
            message: 'Request sent successfully',
            request: {
                ...request.toJSON(),
                _id: result.insertedId
            }
        });
    } catch (error) {
        console.error('Error sending request:', error);
        res.status(500).json({
            message: 'Error sending collaboration request',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get student's sent requests
 * GET /api/supervisors/my-requests
 */
const getMyRequests = async (req, res) => {
    try {
        const studentUid = req.user.uid;

        const requestsCollection = await getSupervisorRequestsCollection();
        const requests = await requestsCollection
            .find({ studentId: studentUid })
            .sort({ createdAt: -1 })
            .toArray();

        // Get supervisor details for each request
        const usersCollection = await getUsersCollection();
        const supervisorIds = [...new Set(requests.map(r => r.supervisorId))];
        const supervisors = await usersCollection
            .find({ uid: { $in: supervisorIds } })
            .project({ uid: 1, name: 1, displayName: 1, email: 1, department: 1 })
            .toArray();

        const supervisorMap = supervisors.reduce((acc, sup) => {
            acc[sup.uid] = {
                name: sup.name || sup.displayName,
                email: sup.email,
                department: sup.department
            };
            return acc;
        }, {});

        const enrichedRequests = requests.map(req => ({
            ...req,
            supervisor: supervisorMap[req.supervisorId]
        }));

        res.json({
            success: true,
            count: enrichedRequests.length,
            requests: enrichedRequests
        });
    } catch (error) {
        console.error('Error fetching student requests:', error);
        res.status(500).json({
            message: 'Error fetching your requests',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get supervisor's pending requests
 * GET /api/supervisors/pending-requests
 */
const getPendingRequests = async (req, res) => {
    try {
        const supervisorUid = req.user.uid;

        const requestsCollection = await getSupervisorRequestsCollection();
        const requests = await requestsCollection
            .find({
                supervisorId: supervisorUid,
                status: 'pending'
            })
            .sort({ createdAt: 1 }) // Oldest first
            .toArray();

        // Get student details for each request
        const usersCollection = await getUsersCollection();
        const studentIds = [...new Set(requests.map(r => r.studentId))];
        const students = await usersCollection
            .find({ uid: { $in: studentIds } })
            .project({ uid: 1, name: 1, displayName: 1, email: 1, department: 1, skills: 1 })
            .toArray();

        const studentMap = students.reduce((acc, student) => {
            acc[student.uid] = {
                name: student.name || student.displayName,
                email: student.email,
                department: student.department,
                skills: student.skills || []
            };
            return acc;
        }, {});

        // Get project details if projectId exists
        const projectsCollection = await getProjectsCollection();
        const projectIds = requests
            .filter(r => r.projectId)
            .map(r => new ObjectId(r.projectId));

        const projects = projectIds.length > 0
            ? await projectsCollection
                .find({ _id: { $in: projectIds } })
                .project({ _id: 1, title: 1, abstract: 1, requiredSkills: 1 })
                .toArray()
            : [];

        const projectMap = projects.reduce((acc, project) => {
            acc[project._id.toString()] = project;
            return acc;
        }, {});

        const enrichedRequests = requests.map(req => ({
            ...req,
            student: studentMap[req.studentId],
            project: req.projectId ? projectMap[req.projectId] : null
        }));

        res.json({
            success: true,
            count: enrichedRequests.length,
            requests: enrichedRequests
        });
    } catch (error) {
        console.error('Error fetching pending requests:', error);
        res.status(500).json({
            message: 'Error fetching pending requests',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Respond to collaboration request (approve/reject)
 * PATCH /api/supervisors/request/:id/respond
 */
const respondToRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const supervisorUid = req.user.uid;

        // Validate request body
        const { error, value } = supervisorResponseSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                message: 'Invalid response data',
                errors: error.details.map(d => d.message)
            });
        }

        const { action, response } = value;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid request ID' });
        }

        const requestsCollection = await getSupervisorRequestsCollection();
        const request = await requestsCollection.findOne({ _id: new ObjectId(id) });

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Verify this request is for the current supervisor
        if (request.supervisorId !== supervisorUid) {
            return res.status(403).json({ message: 'This request is not for you' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request has already been responded to' });
        }

        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        // Update request status
        await requestsCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: newStatus,
                    supervisorResponse: response || '',
                    respondedAt: new Date()
                }
            }
        );

        // If approved and projectId exists, assign supervisor to project
        if (action === 'approve' && request.projectId) {
            const projectsCollection = await getProjectsCollection();
            await projectsCollection.updateOne(
                { _id: new ObjectId(request.projectId) },
                {
                    $set: {
                        supervisorId: supervisorUid,
                        updatedAt: new Date()
                    }
                }
            );

            // Add project to supervisor's supervisedProjects
            const usersCollection = await getUsersCollection();
            await usersCollection.updateOne(
                { uid: supervisorUid },
                {
                    $addToSet: { supervisedProjects: request.projectId }
                }
            );
        }

        // TODO: Send notification to student

        res.json({
            success: true,
            message: `Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
            newStatus
        });
    } catch (error) {
        console.error('Error responding to request:', error);
        res.status(500).json({
            message: 'Error responding to request',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    browseSupervisors,
    sendRequest,
    getMyRequests,
    getPendingRequests,
    respondToRequest,
};
