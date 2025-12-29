// Utility functions for skill-based team matching

/**
 * Calculate match score between student skills and project requirements
 * @param {Array<string>} studentSkills - Array of student's skills
 * @param {Array<string>} requiredSkills - Array of project's required skills
 * @returns {Object} Match details with score, matched and missing skills
 */
function calculateMatchScore(studentSkills, requiredSkills) {
    if (!requiredSkills || requiredSkills.length === 0) {
        return {
            score: 0,
            matchedSkills: [],
            missingSkills: [],
            totalRequired: 0,
            matchLevel: 'no_requirements'
        };
    }

    if (!studentSkills || studentSkills.length === 0) {
        return {
            score: 0,
            matchedSkills: [],
            missingSkills: requiredSkills,
            totalRequired: requiredSkills.length,
            matchLevel: 'needs_training'
        };
    }

    // Normalize skills to lowercase for case-insensitive matching
    const normalizedStudentSkills = studentSkills.map(s => s.toLowerCase().trim());
    const normalizedRequiredSkills = requiredSkills.map(s => s.toLowerCase().trim());

    // Find matched and missing skills
    const matchedSkills = normalizedRequiredSkills.filter(skill =>
        normalizedStudentSkills.includes(skill)
    );

    const missingSkills = normalizedRequiredSkills.filter(skill =>
        !normalizedStudentSkills.includes(skill)
    );

    // Calculate match score as percentage
    const matchScore = (matchedSkills.length / normalizedRequiredSkills.length) * 100;

    // Determine match level
    let matchLevel;
    if (matchScore >= 70) {
        matchLevel = 'best_fit';
    } else if (matchScore >= 40) {
        matchLevel = 'good_fit';
    } else {
        matchLevel = 'needs_training';
    }

    return {
        score: Math.round(matchScore),
        matchedSkills,
        missingSkills,
        totalRequired: normalizedRequiredSkills.length,
        matchLevel
    };
}

/**
 * Find and rank potential team members for a project
 * @param {Array} students - Array of student user objects with skills
 * @param {Array<string>} requiredSkills - Project's required skills
 * @param {number} minScore - Minimum match score to include (default 0)
 * @returns {Array} Sorted array of student matches with scores
 */
function findMatchingStudents(students, requiredSkills, minScore = 0) {
    if (!students || students.length === 0) {
        return [];
    }

    const matches = students.map(student => {
        const matchData = calculateMatchScore(student.skills || [], requiredSkills);

        return {
            studentId: student.uid,
            name: student.name || student.displayName,
            email: student.email,
            department: student.department,
            skills: student.skills || [],
            ...matchData
        };
    }).filter(match => match.score >= minScore);

    // Sort by match score (descending)
    return matches.sort((a, b) => b.score - a.score);
}

/**
 * Group students by match level
 * @param {Array} matchedStudents - Array of student matches from findMatchingStudents
 * @returns {Object} Students grouped by match level
 */
function groupByMatchLevel(matchedStudents) {
    return {
        best_fit: matchedStudents.filter(s => s.matchLevel === 'best_fit'),
        good_fit: matchedStudents.filter(s => s.matchLevel === 'good_fit'),
        needs_training: matchedStudents.filter(s => s.matchLevel === 'needs_training')
    };
}

module.exports = {
    calculateMatchScore,
    findMatchingStudents,
    groupByMatchLevel,
};
