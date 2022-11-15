const express = require('express');
const bodyParser = require('body-parser');
const {sequelize, Profile, Contract, Job} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const { Op, ENUM } = require("sequelize")
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

    //creating an array only with ids to pass on the condition IN 
    contract.forEach(element => {
        if (element.dataValues?.id) { 
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
    const {Profile} = req.app.get('models')
    const {Contract} = req.app.get('models')
    const balance = req.profile.balance
    const payment = req.body

    //get the job id by parameter
    //get the contractId to identify which contract is for that job
    //get the contractor by the contractorId on the contract 
    //verify and move money
    
    const {job_id} = req.params
    const jobs = await Job.findOne({ where: {
        id: { 
            [Op.eq]: job_id
        }
    }})

    const contractId = jobs.ContractId;
    const contract = await Contract.findOne({ where: {
        id: { 
            [Op.eq]: contractId
        }
    }})

    const contractorId = contract.ContractorId;
    const contractorToBePaid = await Profile.findOne({ where: { 
        id: { 
            [Op.eq]: contractorId
        }
    }})

    //I get confused what do I have to verify here on the body to get the payment
    if (contractorToBePaid.type === 'contractor') { 
        if (contractorToBePaid.balance >= payment.paid) {
            await Profile.update({balance: balance}, { 
                where: { 
                    id: {
                        [Op.eq]: contractorId
                    }
                }
            })
        }
    }
    
    return res.status(200).end()
});


/** 5
 * Deposits money into the balance of a client, a client can't deposit <- didn't understanding what is asked here
 * more than 25% his total of jobs to pay. (at the deposit moment)
 */
 app.post('/balances/deposit/:userId', getProfile, async (req, res) =>{
    //Now I get pretty confused, the client id should be the :userId, profile_id(header) or id(json request)? 
    const {Job} = req.app.get('models')
    const {Profile} = req.app.get('models')
    const {Contract} = req.app.get('models')
    const {userId} = req.params

    return res.status(501).end()
});


/** 6
 * @returns The profession that earned the most money (sum of jobs paid) for 
 * any contactor that worked in the query time range.
 */
 app.get('/admin/best-profession', getProfile, async (req, res) =>{
    const {Job} = req.app.get('models')
    const {Profile} = req.app.get('models')
    const {Contract} = req.app.get('models')
    const { startDate, endDate } = req.query
    let arrayIds = []
    let arrayContractors = []
    let arrayJobs = []

    const onlyContractors = await Profile.findAll({ where: { 
        type: { 
            [Op.eq]: 'contractor'
        }
    }})

    onlyContractors.forEach(element => {
        if (element.dataValues?.id) { 
            arrayContractors.push(element.dataValues.id);
        }    
    });

    const contract = await Contract.findAll({ where: {
        ContractorId: { 
            [Op.in]: arrayContractors
        }
    }})

    contract.forEach(element => {
        if (element.dataValues?.id) { 
            arrayIds.push(element.dataValues.id);
        }    
    });

    //here I have all paid jobs made by contractors
    const jobs = await Job.findAll({ where: {
        paid: { 
            [Op.eq]: true,  
        },
        ContractId: { 
            [Op.in]: arrayIds
        },
        paymentDate: { 
            [Op.between]: [startDate, endDate]
        }
    }})

    jobs.forEach(element => {
        if (element.dataValues?.id) { 
            arrayJobs.push(element.dataValues.id);
        }    
    });

    const profession = await Profile.findAll({ where: { 
        id: { 
            [Op.in]: arrayJobs
        }
    },
        //sum of all the jobs filtered
        attributes: [
            'profession',
            [sequelize.fn('sum', sequelize.col('balance')), 'total_balance'],
        ],   
        group: ['profession'],
        raw: true
    })

    if(!profession) return res.status(404).end()
    res.json(profession)
});


/** 7
 * @returns The clients the paid the most for jobs in the query time period. 
 * limit query parameter should be applied, default limit is 2.
 */
 app.get('/admin/best-clients', getProfile, async (req, res) =>{
    const {Job} = req.app.get('models')
    const {Profile} = req.app.get('models')
    const {Contract} = req.app.get('models')
    const { startDate, endDate, limit } = req.query
    let arrayContracts = []
    let arrayClients = []

    const jobs = await Job.findAll({ where: {
        paid: { 
            [Op.eq]: true,  
        },
        paymentDate: { 
            [Op.between]: [startDate, endDate]
        },
    },
        attributes: [
            'ContractId', 'paid', 'paymentDate',
            [sequelize.fn('max', sequelize.col('price')), 'max_amount_paid']
        ],
        group: ['ContractId', 'paid', 'paymentDate'],
        raw: true,
        limit: limit,
    })

    jobs.forEach(element => {
        if (element.ContractId) { 
            arrayContracts.push(element.ContractId);
        }    
    });

    const contract = await Contract.findAll({ where: {
        id: { 
            [Op.in]: arrayContracts
        }
    }})

    contract.forEach(element => {
        if (element.dataValues?.ClientId) { 
            arrayClients.push(element.dataValues?.ClientId);
        }    
    });

    const clientsPaidMost = await Profile.findAll({ where: { 
        id: { 
            [Op.in]: arrayClients
        }
    }})

    if(!clientsPaidMost) return res.status(404).end()
    res.json(clientsPaidMost)
});

module.exports = app;
