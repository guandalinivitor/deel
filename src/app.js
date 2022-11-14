const express = require('express');
const bodyParser = require('body-parser');
const {sequelize, Profile, Contract} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const app = express();
const routes = require('./router');
app.use(routes);
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * FIX ME!
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
})

module.exports = app;
