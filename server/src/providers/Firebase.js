/**
 * ROS: Original scaffolding.

import firebase from 'firebase/app';
import 'firebase/database';

const firebaseConfig = {
  apiKey: "<API_KEY>",
  authDomain: "<PROJECT_ID>.firebaseapp.com",
  databaseURL: "<DATABASE_ID>.firebaseio.com",
  projectId: "<PROJECT_ID>",
  storageBucket: "<BUCKET>.appspot.com",
  messagingSenderId: "<MESSAGING_SENDER_ID>",
  appId: "<APP_ID>",
  measurementId: "<MEASUREMENT_ID>"
};

 */

// ======================================================

import firebase from 'firebase/app';
import 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA6dyecNdls2OfjlKBq8xvfpSwagBCH_rw",
  authDomain: "dolby-classroom-express.firebaseapp.com",
  projectId: "dolby-classroom-express",
  storageBucket: "dolby-classroom-express.appspot.com",
  messagingSenderId: "441075607771",
  appId: "1:441075607771:web:35d2985eeefa5c97ad04fe"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

export { db };