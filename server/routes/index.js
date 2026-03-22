const { Router } = require('express');
const controllerRouter = require('../controllers');

const router = Router();

router.use(controllerRouter);

module.exports = router;
