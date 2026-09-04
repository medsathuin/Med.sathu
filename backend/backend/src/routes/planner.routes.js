const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const plannerController = require('../controllers/planner.controller');

// ========== SYLLABUS ==========
router.post('/syllabus', auth, plannerController.createSyllabus);
router.get('/syllabus', auth, plannerController.getSyllabus);
router.put('/syllabus/:id', auth, plannerController.updateSyllabus);
router.delete('/syllabus/:id', auth, plannerController.deleteSyllabus);
router.post('/syllabus/:id/topic-complete', auth, plannerController.markTopicComplete);
router.post('/syllabus/ai-generate', auth, plannerController.generateAISyllabus);

// ========== DAILY PLAN & SCHEDULE ==========
router.get('/daily-plan', auth, plannerController.getDailyPlan);
router.post('/generate-schedule', auth, plannerController.generateSchedule);

// ========== LECTURES ==========
router.post('/lecture', auth, plannerController.createLecture);
router.get('/lecture', auth, plannerController.getLectures);
router.put('/lecture/:id', auth, plannerController.updateLecture);
router.delete('/lecture/:id', auth, plannerController.deleteLecture);

// ========== LIVE TEACHING ==========
router.post('/lecture/:id/start-live', auth, plannerController.startLive);
router.post('/lecture/:id/end-live', auth, plannerController.endLive);
router.post('/lecture/:id/join', auth, plannerController.joinLecture);
router.post('/lecture/:id/leave', auth, plannerController.leaveLecture);

// ========== REVISION PLANNER ==========
router.post('/revision', auth, plannerController.createRevisionPlan);
router.get('/revision', auth, plannerController.getRevisionPlans);
router.put('/revision/:id', auth, plannerController.updateRevisionPlan);
router.delete('/revision/:id', auth, plannerController.deleteRevisionPlan);

// ========== SHARE LINKS ==========
router.post('/share', auth, plannerController.createShareLink);
router.get('/share', auth, plannerController.getMyShareLinks);
router.delete('/share/:id', auth, plannerController.deleteShareLink);
router.get('/shared/:token', plannerController.getShareLink);

module.exports = router;