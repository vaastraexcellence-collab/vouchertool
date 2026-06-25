const express = require('express');
const { RouterOSClient } = require('routeros-client');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// 🔴 यहाँ आफ्ना सबै माइक्रोतिक राउटरहरूको विवरण थप्नुहोस्
const routers = {
    'b10': {
        host: 'het0976vhvw.sn.mynetname.net', // आफ्नो Cloud DDNS हाल्नुहोस्
        user: 'remote',
        pass: 'myresettool@123'
    }
    // थप राउटर भएमा b11, b12 गरेर तल थप्न सक्नुहुन्छ
};

// Search Action
app.post('/api/search', async (req, res) => {
    const { router, card } = req.body;
    if (!routers[router]) return res.json({ status: 'error', message: 'राउटर भेटिएन' });

    const client = new RouterOSClient({
        host: routers[router].host,
        user: routers[router].user,
        password: routers[router].pass,
        port: 8728,
        timeout: 5
    });

    try {
        const api = await client.connect();
        
        // हटस्पट युजर खोज्ने
        const users = await api.menu('/ip/hotspot/user').print({ name: card });
        if (users.length === 0) {
            await client.close();
            return res.json({ status: 'not_found', message: 'यो कार्ड राउटरमा भेटिएन' });
        }

        const user = users[0];
        
        // एक्टिभ सेसन खोज्ने
        const activeUsers = await api.menu('/ip/hotspot/active').print({ user: card });
        const isOnline = activeUsers.length > 0;
        
        const mac = isOnline ? (activeUsers[0]['mac-address'] || user['mac-address'] || 'N/A') : (user['mac-address'] || 'N/A');
        const ip = isOnline ? (activeUsers[0]['address'] || 'N/A') : 'N/A';

        await client.close();
        
        res.json({
            status: 'found',
            user: user.name,
            profile: user.profile || 'default',
            comment: user.comment || 'No comment',
            mac: mac,
            ip: ip,
            online: isOnline ? 'Online' : 'Offline'
        });

    } catch (err) {
        res.json({ status: 'error', message: 'राउटर कनेक्सन असफल: ' + err.message });
    }
});

// Reset Action
app.post('/api/reset', async (req, res) => {
    const { router, card } = req.body;
    if (!routers[router]) return res.json({ status: 'error', message: 'राउटर भेटिएन' });

    const client = new RouterOSClient({
        host: routers[router].host,
        user: routers[router].user,
        password: routers[router].pass,
        port: 8728
    });

    try {
        const api = await client.connect();
        const users = await api.menu('/ip/hotspot/user').print({ name: card });
        
        if (users.length > 0) {
            // MAC Reset गर्ने
            await api.menu('/ip/hotspot/user').set({ '.id': users[0]['.id'], 'mac-address': '00:00:00:00:00:00' });
            
            // Active session किक गर्ने
            const activeUsers = await api.menu('/ip/hotspot/active').print({ user: card });
            if (activeUsers.length > 0) {
                await api.menu('/ip/hotspot/active').remove({ '.id': activeUsers[0]['.id'] });
            }

            await client.close();
            res.json({ status: 'success', message: 'कार्ड सफलतापूर्वक रिसेट भयो!' });
        } else {
            await client.close();
            res.json({ status: 'error', message: 'कार्ड भेटिएन' });
        }
    } catch (err) {
        res.json({ status: 'error', message: 'रिसेट असफल: ' + err.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(Server connected on port ${PORT}));