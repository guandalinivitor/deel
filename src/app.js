const express = require('express');
const bodyParser = require('body-parser');
const {sequelize, Profile, Contract, Job} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const { Op } = require("sequelize")
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/** 1
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) =>{
    const {Contract} = req.app.get('models')
    const {id} = req.params
    
    let contract;
    if (req.profile?.type === "client") { 
        contract = await Contract.findOne({ where: {id: id} && {ClientId: req.profile.id}})
    } else { 
        contract = await Contract.findOne({ where: {id: id} && {ContractorId: req.profile.id}})
    }

    if(!contract) return res.status(404).end()
    res.json(contract)
});


/** 2
 * @returns a list of contracts belonging to a user and non terminated contracts
 */
app.get('/contracts', getProfile, async (req, res) =>{
    const {Contract} = req.app.get('models')
    const contract = await Contract.findAll({ where: {
        [Op.or]: [{ClientId: req.profile.id}, {ContractorId: req.profile.id}],
        [Op.notIn]: [{status: 'terminated'}] 
    }})
    if(!contract) return res.status(404).end()
    res.json(contract)
});


/** 3
 * @returns All unpaid jobs for a user and active contracts only.
 */
 app.get('/jobs/unpaid', getProfile, async (req, res) =>{
    const {Job} = req.app.get('models')
    const {Contract} = req.app.get('models')
    let arrayIds = []

    const contract = await Contract.findAll({ where: {
        [Op.or]: [{ClientId: req.profile.id}, {ContractorId: req.profile.id}],
        [Op.and]: [{status: 'in_progress'}] 
    }})

    contract.forEach(element => {
        if (element.dataValues.id) { 
            arrayIds.push(element.dataValues.id);
        }    
    });

    const jobs = await Job.findAll({ where: {
        paid: { 
            [Op.not]: true,  
        },
        ContractId: { 
            [Op.in]: arrayIds
        }
    }})

    if(!jobs) return res.status(404).end()
    res.json(jobs)
});


/** 4
 * Pay for a job, a client can only pay if his balance >= the amount to pay. 
 * The amount should be moved from the client's balance to the contractor balance.
 */
 app.post('/jobs/:job_id/pay', getProfile, async (req, res) =>{
    const {Job} = req.app.get('models')
    const {Contract} = req.app.get('models')

    if(!jobs) return res.status(404).end()
    res.json(jobs)
});


/** 5
 * Deposits money into the the the balance of a client, a client can't deposit 
 * more than 25% his total of jobs to pay. (at the deposit moment)
 */
 app.post('/balances/deposit/:userId', getProfile, async (req, res) =>{
    const {Job} = req.app.get('models')
    const {Contract} = req.app.get('models')

    if(!jobs) return res.status(404).end()
    res.json(jobs)
});


/** 6
 * @returns The profession that earned the most money (sum of jobs paid) for 
 * any contactor that worked in the query time range.
 */
 app.get('/admin/best-profession?start=<date>&end=<date>', getProfile, async (req, res) =>{
    const {Job} = req.app.get('models')
    const {Contract} = req.app.get('models')

    if(!jobs) return res.status(404).end()
    res.json(jobs)
});


/** 7
 * @returns the clients the paid the most for jobs in the query time period. 
 * limit query parameter should be applied, default limit is 2.
 */
 app.get('/admin/best-clients?start=<date>&end=<date>&limit=<integer>', getProfile, async (req, res) =>{
    const {Job} = req.app.get('models')
    const {Contract} = req.app.get('models')

    if(!jobs) return res.status(404).end()
    res.json(jobs)
});

module.exports = app;
