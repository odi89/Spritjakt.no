import React from 'react';
import './App.css';
import ProductList from './components/ProductList';
import {ReactComponent as ReactLogo} from './assets/logo.svg';
import firebase from 'firebase/app';
import 'firebase/analytics';
import SearchBar from './components/SearchBar';
const firebaseConfig = require ("./config.json");

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
firebase.analytics();

class App extends React.Component {


  render(){
  return (
    <div className="App">
      <header className="App-header">
        <a href="">
          <h1><ReactLogo /><span style={{width: 0, overflow:"hidden"}}>Spritjakt</span></h1>
        </a>
        <p>Når Vinmonopolets produkter blir satt opp eller ned i pris vil de dukke opp her.</p>
      </header>
      <div className="Body">
        <SearchBar />
        <ProductList />
      </div>
      <footer>
        Priser og lagerbeholdning oppdateres daglig, hendholdsvis  06:15 og 08:15
        <br />
        <span data-nosnippet="true">
          © 2020 Mats Løvstrand Berntsen
        </span>
        </footer>
    </div>
    );
  }
}

export default App;
