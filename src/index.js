const path = require('path')
const http = require('http')
const socketio = require('socket.io')
const Filter = require('bad-words')
const express = require('express')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const app = express()
const server = http.createServer(app) //created it to pass it to socketio manually
const io = socketio(server)
const{ addUser,removeUser,getUser,getUsersInRoom } = require('./utils/users')

const port = process.env.PORT||3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))


//server (emit) --> client (recieve) -- countUpdated
//client (emit) --> server (recieve) -- increment

io.on('connection', (socket) => {

    console.log('New websocket connection!')

//message for a new user and for other users.

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })

        if (error) {
           return callback(error)
        }
        
        socket.join(user.room)

        socket.emit('message', generateMessage('Admin', 'Welcome!') ) //message 1
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`)) //message 2
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

// socket.emit - sends an event to specific client
// io.emit - for sending message to all clients
// socket.broadcast.emit - to send an event to all clients for the socket itself
// io.to.emit - sends msg to all clients
// socket.broadcast.to.emit - sends msg to all clients in a room

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)
        const filter = new Filter()

        if(filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        }

// message event emitted to transfer the message of a user to other users.
        io.to(user.room).emit('message', generateMessage(user.username, message))
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

//message event emitted when a user leaves a chat room.
    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})


server.listen(port, () => {
    console.log(`Server is up on ${port}!`)
})