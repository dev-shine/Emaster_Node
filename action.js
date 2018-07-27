'use strict'

//const {Sitngo} = require('@proak/proak-model')

const steam = require('steam')
const dota2 = require('dota2')
steam.servers = require('./config/steam_servers.json')

let steamClient
let steamUser
let Dota2

// Multi - Create
function respond(event, cb) {
     console.log('dota2/lobby/create')

     let data = event
     let bot = data['bot']

     let logOnDetails = {
          'account_name': bot['username'],
          'password': bot['password']
     }

     steamClient = new steam.SteamClient()
     steamUser = new steam.SteamUser(steamClient)
     Dota2 = new dota2.Dota2Client(steamClient, true)

     console.log('going to connect to steam')

     steamClient.connect()

     steamClient.on('connected', function() {
          console.log('connected to steam')
          steamUser.logOn(logOnDetails)
     })

     steamClient.on('logOnResponse', function(logonResp) {
          console.log('Steam on longOnResponse')
          if (logonResp.eresult === steam.EResult.OK) {
               console.log('Logged on.')

               Dota2.launch()
               Dota2.on('ready', function() {
                    console.log('Node-dota2 ready.')
                    return createLobby(data, cb)
               })

               Dota2.on('unready', function onUnready() {
                    console.log('Node-dota2 unready.')
                    return cb(createError('Could not start dota2 client.'), null)
               })
          }
     })
     steamClient.on('loggedOff', function(eresult) {
          console.log('Logged off from Steam: ', eresult)
          return cb(createError('Logged off from Steam.' + eresult), null)
     })

     steamClient.on('error', function(error) {
          console.log('Connection closed by server: ', error)
          return cb(createError('Connection closed by server: ' + error), null)
     })
}

function createLobby(data, cb) {

     let properties = {
          'game_name': 'eMasters-' + data['sitngo']['id'].substr(0, 10),
          'pass_key': data['sitngo']['id'],
          'server_region': getRegion(data['sitngo']['region']),
          'game_mode': getGameType(data['sitngo']['gameType']),
          'series_type': 0,
          'game_version': 1,
          'allow_cheats': false,
          'fill_with_bots': false,
          'allow_spectating': true,
          'radiant_series_wins': 0,
          'dire_series_wins': 0,
          'allchat': true
     }

     let numberOfPlayers = parseInt(data['sitngo']['maxPlayers'])

     Dota2.createPracticeLobby(properties, function(err, response) {
          if (err) {
               console.log(err + ' - ' + JSON.stringify(response))
               return cb(createError('Could not createLobby lobby: ' + error), null)
          } else if (response.eresult !== steam.EResult.OK) {
               return cb(createError('Fail to createLobby lobby.'), null)
          }
          Dota2.practiceLobbyKickFromTeam(Dota2.AccountID)
          data['sitngo']['status'] = 'ready'
          // updateSitngo(data['sitngo']).then(result => {
          //      data['sitngo'] = result
          // }).catch(err => {
          //      return cb(err, null)
          // })
     })

     let launching = false
     Dota2.on('practiceLobbyUpdate', function(lobby) {
          if (!data['sitngo']['metadata']) {
               data['sitngo']['metadata'] = JSON.parse(JSON.stringify(lobby))
          }

          if (checkNumberOfPlayers(JSON.parse(JSON.stringify(lobby)), numberOfPlayers)) {
               if (!launching) {
                    launching = true
                    return startLobby(data, cb)
               }
          }
     })
}

function checkNumberOfPlayers(lobby, maxPlayers) {
     let members = lobby['members']

     // if the total number of members is less than expected just return false
     if (members.length - 1 < maxPlayers) {
          return false
     }

     // checking team composition
     let radiantTeam = []
     let direTeam = []
     members.forEach(m => {
          if (m['team'] === 'DOTA_GC_TEAM_GOOD_GUYS') {
               radiantTeam.push(m)
          } else if (m['team'] === 'DOTA_GC_TEAM_BAD_GUYS') {
               direTeam.push(m)
          }
     })

     // if members are not equal do not launch
     if (radiantTeam.length !== direTeam.length) {
          return false
     }

     let total = radiantTeam.length + direTeam.length
     return total === maxPlayers
}

const regions = [
     {
          'default': 0
     }, {
          'iad': 1
     }, {
          'eat': 2
     }, {
          'lux': 3
     }, {
          'kr': 4
     }, {
          'sgp-1': 5
     }, {
          'dxb': 6
     }, {
          'syd': 7
     }, {
          'sto': 8
     }, {
          'vie': 9
     }, {
          'gru': 10
     }, {
          'cpt-1': 11
     }, {
          'chile': 14
     }, {
          'peru': 15
     }, {
          'india': 16
     }, {
          'jp': 19
     }
]

function getRegion(region) {
     let result = 0
     regions.forEach(r => {
          if (r[region]) {
               result = r[region]
          }
     })
     return result
}

function getGameType(type) {
     let result
     switch (type) {
          case 'all_pick':
               result = dota2.schema.lookupEnum('DOTA_GameMode').values.DOTA_GAMEMODE_AP
               break
          case 'random_draft':
               result = dota2.schema.lookupEnum('DOTA_GameMode').values.DOTA_GAMEMODE_RD
               break
          case 'single_draft':
               result = dota2.schema.lookupEnum('DOTA_GameMode').values.DOTA_GAMEMODE_SD
               break
          case 'x1_mid':
               result = dota2.schema.lookupEnum('DOTA_GameMode').values.DOTA_GAMEMODE_1V1MID
               break
          case 'ranked_all_pick':
               result = dota2.schema.lookupEnum('DOTA_GameMode').values.DOTA_GAMEMODE_AR
               break
          default:
               result = dota2.schema.lookupEnum('DOTA_GameMode').values.DOTA_GAMEMODE_AP
     }
     return result
}

function startLobby(data, cb) {
     console.log('starting lobby')
     Dota2.launchPracticeLobby(function(err, response) {
          if (err) {
               console.log(err + ' - ' + JSON.stringify(response))
               return cb(createError('Could not start lobby: ' + error), null)
          } else if (response.eresult !== steam.EResult.OK) {
               return cb(createError('Fail to start lobby.'), null)
          } else {
               leaveLobby(data['sitngo']['metadata']['lobby_id'])
               return cb(null, data)
          }
     })
}

function leaveLobby(id) {
     Dota2.abandonCurrentGame()
     Dota2.leavePracticeLobby()
     Dota2.leaveChat('Lobby_' + id)
     disconnect()
     // Now let's inform the dispatcher that this bot is free
     lambda.invoke({
           FunctionName: `proak-api-${constants.STAGE}-gameDispatcher`,
           Payload: JSON.stringify(jsonPayload),
           InvocationType: 'Event'
         }, function (error, data) {
           if (error !== null) {
             console.log(error)
             reject(error)
           } else {
             resolve(data)
           }
         })
}

function disconnect() {
     Dota2.exit()
     steamClient.disconnect()
}

function createError(message) {
     return {message: message}
}

// function updateSitngo(data) {
//      return new Promise((resolve, reject) => {
//           Sitngo.dynamodb().update({
//                id: data['id'],
//                status: data['status'],
//                metadata: data['metadata']
//           }, {
//                overwrite: true
//           }, function(err, data) {
//                if (err === null) {
//                     resolve(data)
//                } else {
//                     reject(err)
//                }
//           })
//      })
// }

// Export entry module
module.exports = {
     respond
}
