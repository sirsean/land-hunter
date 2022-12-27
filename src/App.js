import React from 'react';
import { Provider, useSelector } from 'react-redux';
import { createSlice, configureStore } from '@reduxjs/toolkit';
import sortBy from 'sort-by';
import './App.css';

const API_URL = 'https://liquidlands-api.sirsean.workers.dev';
//const APP_VERSION = '10189a1a1';

const ALLIED_FACTION_IDS = new Set([
    199, // Homie G
    249, // Wandernauts
    266, // Cryptorunners
    240, // Bored Ape Pixel Club
    243, // Bored 2 Death Club
    253, // Battle Bunnies
    239, // TrapMonkie
    349, // Northern Guilds
]);

const slice = createSlice({
    name: 'land-hunter',
    initialState: {
        error: null,
        lands: null,
    },
    reducers: {
        setError: (state, action) => {
            state.error = action.payload;
        },
        setLands: (state, action) => {
            state.lands = action.payload;
        },
    },
});

const {
    //setError,
    setLands,
} = slice.actions;
const store = configureStore({
    reducer: slice.reducer,
});

const selectError = state => state.error;
const selectLands = state => {
    if (state.lands) {
        return Object.keys(state.lands).map(landId => state.lands[landId]).filter(land => land.defense < 10).sort(sortBy('-maxReward')).splice(0, 100);
    } else {
        return [];
    }
};

function calculateReward(bricksPerDay, timeString) {
    if (timeString === null) {
        return 0;
    } else {
        if (!timeString.includes('Z')) {
            timeString = timeString.replace(/\.\d+$/, '.000') + 'Z';
        }
        const time = new Date(timeString);
        const now = new Date();
        const ms = now.getTime() - time.getTime();
        const hours = (ms / 1000 / 60 / 60);
        const days = Math.min(2, hours / 24);
        return ((bricksPerDay * days) / 3.7);
    }
}

async function fetchLands() {
    return fetch(`${API_URL}/raw/land`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }).then(r => r.json())
    .then(coll => coll.map(([tileId, mapId, factionId, guardedAt, bricksPerDay, defense, country]) => {
        const maxReward = calculateReward(bricksPerDay, guardedAt);
        return { tileId, mapId, factionId, bricksPerDay, guardedAt, maxReward, defense, country };
    })).then(lands => {
        return lands
            .filter(l => (!ALLIED_FACTION_IDS.has(l.factionId)))
            .filter(l => (l.maxReward >= 0.05))
            //.splice(0, 5)
    }).then(lands => {
        const landMap = lands.reduce((acc, l) => {
            acc[l.tileId] = l;
            return acc;
        }, {});
        store.dispatch(setLands(landMap));
    }).catch(e => {
        console.error(e);
    });
}

function LandRow({ land }) {
    const href = `https://liquidlands.io/land/${land.tileId}`;
    return (
        <tr>
            <td className="left"><a href={href} target="_blank" rel="noreferrer">{land.tileId}</a></td>
            <td>{land.country.toUpperCase()}</td>
            <td>{land.maxReward ? land.maxReward.toFixed(6) : ''}</td>
            <td>{land.bricksPerDay.toFixed(3)}</td>
            <td>{land.defense}</td>
        </tr>
    );
}

function LandsList() {
    const lands = useSelector(selectLands);
    if (lands) {
        return (
            <table className="lands">
                <thead>
                    <tr>
                        <th className="left">Land</th>
                        <th>Country</th>
                        <th>Max Raid Reward</th>
                        <th>Bricks Per Day</th>
                        <th>Defense</th>
                    </tr>
                </thead>
                <tbody>
                    {lands.map(l => <LandRow key={l.tileId} land={l} />)}
                </tbody>
            </table>
        );
    }
}

function Error() {
    const msg = useSelector(selectError);
    if (msg && msg !== 'Success') {
        return (
            <div className="error">
                Error: ${msg} ... tell sirsean about it.
            </div>
        );
    }
}

function Main() {
    return (
        <div>
            <LandsList />
        </div>
    );
}

function App() {
    fetchLands();
    return (
        <Provider store={store}>
            <div className="App">
                <Error />
                <Main />
            </div>
        </Provider>
    );
}

export default App;
