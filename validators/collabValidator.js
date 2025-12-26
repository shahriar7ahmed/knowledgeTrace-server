// Collaboration Post Validators
const Joi = require('joi');

const createCollabPostSchema = Joi.object({
    title: Joi.string().trim().min(3).max(100).required()
        .messages({
            'string.empty': 'Title is required',
            'string.min': 'Title must be at least 3 characters long',
            'string.max': 'Title cannot exceed 100 characters',
        }),
    description: Joi.string().trim().min(10).max(1000).required()
        .messages({
            'string.empty': 'Description is required',
            'string.min': 'Description must be at least 10 characters long',
            'string.max': 'Description cannot exceed 1000 characters',
        }),
    skillsRequired: Joi.array().items(Joi.string().trim()).min(1).required()
        .messages({
            'array.min': 'At least one skill is required',
            'any.required': 'Skills required field is required',
        }),
    projectType: Joi.string().valid('Thesis', 'Semester Project', 'Hackathon').required()
        .messages({
            'any.only': 'Project type must be Thesis, Semester Project, or Hackathon',
            'any.required': 'Project type is required',
        }),
});

const updateCollabStatusSchema = Joi.object({
    status: Joi.string().valid('OPEN', 'CLOSED').required()
        .messages({
            'any.only': 'Status must be either OPEN or CLOSED',
            'any.required': 'Status is required',
        }),
});

const collabQuerySchema = Joi.object({
    projectType: Joi.string().valid('All', 'Thesis', 'Semester Project', 'Hackathon').optional(),
    skill: Joi.string().trim().optional(),
    status: Joi.string().valid('All', 'OPEN', 'CLOSED').optional(),
});

module.exports = {
    createCollabPostSchema,
    updateCollabStatusSchema,
    collabQuerySchema,
};
