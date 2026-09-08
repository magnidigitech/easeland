/**
 * Comprehensive Pan-India Location Hierarchy Dataset
 * State -> District -> City/Town -> Mandal/Tehsil -> Locality
 */

export const INDIA_LOCATION_DATA = {
  'Andhra Pradesh': {
    districts: {
      'Visakhapatnam': {
        cities: {
          'Visakhapatnam': {
            mandals: {
              'Visakhapatnam Urban': ['MVP Colony', 'Seethammadhara', 'Siripuram', 'Maharanipeta', 'Dwaraka Nagar', 'Rushikonda', 'Madhurawada'],
              'Gajuwaka Mandal': ['Gajuwaka', 'Steel Plant Township', 'Sheela Nagar', 'Bhavanipuram', 'Duvvada'],
              'Anakapalle Mandal': ['Anakapalle Town', 'Ring Road', 'NTPC Colony']
            }
          },
          'Anakapalle': {
            mandals: {
              'Anakapalle': ['Main Market', 'NTPC Area', 'Kasimkota Road']
            }
          }
        }
      },
      'NTR (Vijayawada)': {
        cities: {
          'Vijayawada': {
            mandals: {
              'Vijayawada Urban': ['Benz Circle', 'Patamata', 'Gunadala', 'Moghalrajpuram', 'Satyanarayanapuram', 'Governorpet'],
              'Penamaluru Mandal': ['Poranki', 'Kanuru', 'Penamaluru', 'Tadigadapa', 'Yenamalakuduru'],
              'Vijayawada Rural': ['Enikepadu', 'Nidamanuru', 'Gollapudi', 'Kesarapalli']
            }
          }
        }
      },
      'Guntur': {
        cities: {
          'Guntur': {
            mandals: {
              'Guntur Urban': ['Brodipet', 'Arundelpet', 'Vidya Nagar', 'Koritepadu', 'Pattabhipuram', 'Ring Road'],
              'Mangalagiri Mandal': ['Mangalagiri Town', 'NRI Hospital Area', 'Nowlur', 'Atmakur'],
              'Tadepalle Mandal': ['Tadepalle', 'Kunchanapalli', 'Vaddeswaram (KLU Area)']
            }
          },
          'Amaravati': {
            mandals: {
              'Amaravati Capital Region': ['Nelapadu', 'Seed Capital', 'Rayapudi', 'Thullur']
            }
          }
        }
      },
      'Tirupati': {
        cities: {
          'Tirupati': {
            mandals: {
              'Tirupati Urban': ['Alipiri', 'MR Palle', 'Bairagipatteda', 'Korlagunta', 'KT Road', 'Tiruchanoor'],
              'Chandragiri Mandal': ['Chandragiri Town', 'SVP Colony'],
              'Renigunta Mandal': ['Renigunta Junction', 'Airport Road', 'Gajulamandyam']
            }
          }
        }
      },
      'Kurnool': {
        cities: {
          'Kurnool': {
            mandals: {
              'Kurnool Urban': ['Nandyal Check Post', 'B-Camp', 'Gayatri Estate', 'Santosh Nagar', 'Roza']
            }
          }
        }
      },
      'YSR Kadapa': {
        cities: {
          'Kadapa': {
            mandals: {
              'Kadapa Urban': ['Seven Roads Junction', 'Rami Reddy Nagar', 'NCS Colony']
            }
          }
        }
      },
      'Anantapur': {
        cities: {
          'Anantapur': {
            mandals: {
              'Anantapur Urban': ['Rudrampeta', 'Housing Board Colony', 'Subash Road']
            }
          }
        }
      },
      'Kakinada': {
        cities: {
          'Kakinada': {
            mandals: {
              'Kakinada Urban': ['Bhanugudi Junction', 'Ramanayyapeta', 'Sarpavaram', 'Vakalapudi']
            }
          }
        }
      },
      'East Godavari': {
        cities: {
          'Rajahmundry': {
            mandals: {
              'Rajahmundry Urban': ['Danavaipeta', 'Morampudi', 'JN Road', 'Kambala Cheruvu', 'Aryapuram']
            }
          }
        }
      },
      'West Godavari': {
        cities: {
          'Eluru': {
            mandals: {
              'Eluru Urban': ['Tangellamudi', 'Sanivarapupeta', 'NR Pet']
            }
          },
          'Bhimavaram': {
            mandals: {
              'Bhimavaram Urban': ['PP Road', 'SRKR Engineering College Area', 'One Town']
            }
          }
        }
      },
      'Nellore': {
        cities: {
          'Nellore': {
            mandals: {
              'Nellore Urban': ['Magunta Layout', 'VRC Centre', 'Pogathota', 'Vedayapalem', 'Dargamitta']
            }
          }
        }
      }
    }
  },
  'Telangana': {
    districts: {
      'Hyderabad': {
        cities: {
          'Hyderabad': {
            mandals: {
              'Khairatabad / Banjara Hills': ['Banjara Hills Road 1-12', 'Jubilee Hills', 'Somajiguda', 'Khairatabad', 'Panjagutta'],
              'Shaikpet / Shaikpet Mandal': ['Tolichowki', 'Shaikpet', 'Filmnagar', 'Mehdipatnam', 'Manikonda Signal'],
              'Begumpet / Ameerpet': ['Ameerpet', 'Begumpet', 'SR Nagar', 'Sanjeeva Reddy Nagar', 'Prakash Nagar'],
              'Secunderabad Urban': ['Secunderabad Station', 'Marredpally', 'Sindhi Colony', 'Bowenpally', 'Trimulgherry'],
              'Musheerabad': ['Himayatnagar', 'Narayanguda', 'Kachiguda', 'RTC X Roads', 'Barkatpura'],
              'Charminar / Old City': ['Charminar', 'Chandrayangutta', 'Santoshnagar', 'Malakpet', 'Faluknama']
            }
          }
        }
      },
      'Ranga Reddy': {
        cities: {
          'Hyderabad Cyberabad West': {
            mandals: {
              'Serilingampally Mandal': ['Gachibowli', 'HITECH City', 'Kondapur', 'Madhapur', 'Nanakramguda', 'Financial District', 'Raidurg', 'Hafeezpet'],
              'Rajendranagar Mandal': ['Attapur', 'Rajendranagar', 'Bandlaguda Jagir', 'Sun City', 'Hyderguda'],
              'Gandipet Mandal': ['Gandipet', 'Narsingi', 'Puppalguda', 'Kokapet', 'Manikonda', 'Neknampur'],
              'Shamshabad Mandal': ['Shamshabad Airport Area', 'Satamrai', 'Tondupally', 'Rashidguda'],
              'Ibrahimpatnam Mandal': ['Ibrahimpatnam Town', 'Bongloor X Roads', 'Mangalpally']
            }
          }
        }
      },
      'Medchal-Malkajgiri': {
        cities: {
          'Hyderabad North & East': {
            mandals: {
              'Kukatpally Mandal': ['Kukatpally Housing Board (KPHB)', 'Kukatpally Main', 'Nizampet', 'Hydernagar', 'Pragathi Nagar', 'Bachupally'],
              'Quthbullapur Mandal': ['Chintal', 'Shapurnagar', 'Quthbullapur', 'Gajularamaram', 'Suraram'],
              'Malkajgiri Mandal': ['Malkajgiri', 'Anandbagh', 'Mouula Ali', 'Neredmet', 'Sainikpuri'],
              'Alwal Mandal': ['Old Alwal', 'New Alwal', 'Lothkunta', 'Temple Alwal'],
              'Medchal Mandal': ['Medchal Town', 'Kompally', 'Gundlapochampally', 'Kistapur'],
              'Uppal Mandal': ['Uppal X Roads', 'Nagole', 'Ramanthapur', 'Habsiguda', 'Boduppal', 'Peerzadiguda']
            }
          }
        }
      },
      'Sangareddy': {
        cities: {
          'Sangareddy / West Outer': {
            mandals: {
              'Patancheru Mandal': ['Patancheru', 'Muthangi', 'Indresham', 'Bhadrappa Nagar'],
              'Ameenpur Mandal': ['Ameenpur', 'Beeramguda', 'Kistareddypet', 'Bandamkommu'],
              'Ramachandrapuram Mandal': ['RC Puram', 'BHEL Township', 'Tellapur', 'Kollur', 'Osmannagar'],
              'Sangareddy Urban': ['Sangareddy Town', 'Pothireddypally', 'Fasalwadi']
            }
          }
        }
      },
      'Hanamkonda / Warangal': {
        cities: {
          'Warangal Tri-Cities': {
            mandals: {
              'Hanamkonda Mandal': ['Hanamkonda X Roads', 'Subedari', 'Naimnagar', 'Kazipet', 'Waddepally'],
              'Warangal Urban Mandal': ['Warangal Fort', 'Subedari', 'Hunter Road', 'Girmsjipet']
            }
          }
        }
      },
      'Karimnagar': {
        cities: {
          'Karimnagar': {
            mandals: {
              'Karimnagar Urban': ['Collectorate Area', 'Mankammathota', 'Mukarampura', 'Kothapalli']
            }
          }
        }
      },
      'Nizamabad': {
        cities: {
          'Nizamabad': {
            mandals: {
              'Nizamabad Urban': ['Khaleelwadi', 'Phulong', 'Vinayak Nagar', 'Kanteshwar']
            }
          }
        }
      },
      'Khammam': {
        cities: {
          'Khammam': {
            mandals: {
              'Khammam Urban': ['Wyra Road', 'Mustafa Nagar', 'Mamillagudem', 'Khanapuram']
            }
          }
        }
      }
    }
  },
  'Maharashtra': {
    districts: {
      'Mumbai Suburban': {
        cities: {
          'Mumbai Western Suburbs': {
            mandals: {
              'Andheri Tehsil': ['Andheri West', 'Andheri East', 'Lokhandwala', 'Juhu', 'Versova', 'Oshiwara', 'Marol', 'Chakala'],
              'Bandra Tehsil': ['Bandra West', 'Bandra East', 'BKC (Bandra Kurla Complex)', 'Khar West', 'Santa Cruz'],
              'Borivali Tehsil': ['Borivali West', 'Borivali East', 'Kandivali West', 'Kandivali East', 'Dahisar'],
              'Malad Tehsil': ['Malad West', 'Malad East', 'Goregaon West', 'Goregaon East', 'Aarey Colony']
            }
          },
          'Mumbai Eastern Suburbs': {
            mandals: {
              'Kurla Tehsil': ['Kurla West', 'Kurla East', 'Ghatkopar West', 'Ghatkopar East', 'Vidyavihar'],
              'Powai / Bhandup Tehsil': ['Powai', 'Hiranandani Gardens', 'Bhandup West', 'Kanjurmarg', 'Mulund West']
            }
          }
        }
      },
      'Mumbai City': {
        cities: {
          'South Mumbai': {
            mandals: {
              'Colaba / Fort': ['Colaba', 'Fort', 'Cuffe Parade', 'Nariman Point', 'Marine Drive'],
              'Dadar / Lower Parel': ['Lower Parel', 'Worli', 'Dadar West', 'Prabhadevi', 'Mahalaxmi']
            }
          }
        }
      },
      'Thane': {
        cities: {
          'Thane City': {
            mandals: {
              'Thane Urban': ['Ghodbunder Road', 'Majiwada', 'Vartak Nagar', 'Naupada', 'Panchpakhadi', 'Kolshet'],
              'Kalyan Tehsil': ['Kalyan West', 'Kalyan East', 'Dombivli West', 'Dombivli East'],
              'Mira-Bhayandar': ['Mira Road East', 'Bhayandar West', 'Bhayandar East']
            }
          },
          'Navi Mumbai': {
            mandals: {
              'Vashi / Nerul': ['Vashi', 'Nerul', 'Belapur', 'Sanpada', 'Juinagar'],
              'Kharghar / Panvel': ['Kharghar', 'Panvel', 'Kamothe', 'Taloja', 'Ulwe']
            }
          }
        }
      },
      'Pune': {
        cities: {
          'Pune City': {
            mandals: {
              'Haveli Tehsil': ['Kothrud', 'Baner', 'Balewadi', 'Aundh', 'Viman Nagar', 'Kharadi', 'Hadapsar', 'Kondhwa', 'Katraj'],
              'Mulshi Tehsil': ['Hinjewadi Phase 1', 'Hinjewadi Phase 2', 'Hinjewadi Phase 3', 'Wakad', 'Tathawade', 'Bavdhan'],
              'Pimpri-Chinchwad': ['Pimple Saudagar', 'Pimple Nilakh', 'Chinchwad', 'Nigdi', 'Ravat', 'Bhosari']
            }
          }
        }
      },
      'Nagpur': {
        cities: {
          'Nagpur': {
            mandals: {
              'Nagpur Urban': ['Dharampeth', 'Sadar', 'Wardha Road', 'Manewada', 'Besa', 'Hingna Road']
            }
          }
        }
      },
      'Nashik': {
        cities: {
          'Nashik': {
            mandals: {
              'Nashik Urban': ['Indira Nagar', 'Gangapur Road', 'College Road', 'Panchavati', 'Pathardi Phata']
            }
          }
        }
      }
    }
  },
  'Karnataka': {
    districts: {
      'Bengaluru Urban': {
        cities: {
          'Bengaluru': {
            mandals: {
              'Bengaluru South': ['Koramangala', 'HSR Layout', 'Jayanagar', 'JP Nagar', 'BTM Layout', 'Banashankari', 'Electronic City Phase 1 & 2', 'Sarjapur Road'],
              'Bengaluru East': ['Indiranagar', 'Whitefield', 'Marathahalli', 'Bellandur', 'Brookefield', 'KR Puram', 'Varthur'],
              'Bengaluru North': ['Hebbal', 'Yelahanka', 'Thanisandra', 'Manyata Tech Park Area', 'HBR Layout', 'RT Nagar'],
              'Bengaluru West': ['Rajajinagar', 'Malleshwaram', 'Vijayanagar', 'Yeshwanthpur', 'Kengeri', 'RR Nagar']
            }
          }
        }
      },
      'Mysuru': {
        cities: {
          'Mysuru': {
            mandals: {
              'Mysuru Urban': ['Gokulam', 'Vijayanagar', 'Kuvempunagar', 'Saraswathipuram', 'Jayalakshmipuram']
            }
          }
        }
      },
      'Dakshina Kannada': {
        cities: {
          'Mangaluru': {
            mandals: {
              'Mangaluru Urban': ['Bejai', 'Kadri', 'Surathkal', 'Kodialbail', 'Urwa']
            }
          }
        }
      }
    }
  },
  'Tamil Nadu': {
    districts: {
      'Chennai': {
        cities: {
          'Chennai': {
            mandals: {
              'Guindy / Mambalam': ['T. Nagar', 'Adyar', 'Mylapore', 'Alwarpet', 'Guindy', 'Velachery', 'Nungambakkam'],
              'Perungudi / Sholinganallur': ['OMR (Old Mahabalipuram Road)', 'Sholinganallur', 'Perungudi', 'Thoraipakkam', 'ECR (East Coast Road)'],
              'Egmore / Aminjikarai': ['Anna Nagar', 'Kilpauk', 'Egmore', 'Chetpet', 'Shenoy Nagar'],
              'Ambattur / Porur': ['Porur', 'Ambattur', 'Koyambedu', 'Maduravoyal', 'Ramapuram']
            }
          }
        }
      },
      'Coimbatore': {
        cities: {
          'Coimbatore': {
            mandals: {
              'Coimbatore North / South': ['RS Puram', 'Peelamedu', 'Gandhipuram', 'Ramanathapuram', 'Saravanampatti', 'Singanallur']
            }
          }
        }
      },
      'Madurai': {
        cities: {
          'Madurai': {
            mandals: {
              'Madurai Urban': ['KK Nagar', 'Anna Nagar', 'Simmakkal', 'SS Colony']
            }
          }
        }
      }
    }
  },
  'Delhi NCR': {
    districts: {
      'South Delhi': {
        cities: {
          'New Delhi': {
            mandals: {
              'Hauz Khas / Saket': ['Hauz Khas', 'Saket', 'Vasant Kunj', 'Greater Kailash 1 & 2', 'Green Park', 'Malviya Nagar', 'Chittaranjan Park'],
              'Defence Colony': ['Defence Colony', 'Lajpat Nagar', 'South Extension', 'Gulmohar Park']
            }
          }
        }
      },
      'Gurugram': {
        cities: {
          'Gurugram': {
            mandals: {
              'Gurugram Urban': ['DLF Phase 1, 2, 3, 4, 5', 'Cyber City', 'Golf Course Road', 'Golf Course Extension Road', 'Sohna Road', 'Sector 56', 'Sector 57'],
              'Dwarka Expressway': ['Sector 102', 'Sector 104', 'Sector 108', 'Sector 111']
            }
          }
        }
      },
      'Gautam Buddha Nagar': {
        cities: {
          'Noida': {
            mandals: {
              'Noida Central & Expressway': ['Sector 18', 'Sector 62', 'Sector 50', 'Sector 137', 'Sector 128', 'Sector 150'],
              'Greater Noida': ['Greater Noida West (Noida Extension)', 'Alpha 1 & 2', 'Beta 1', 'Gamma', 'Knowledge Park']
            }
          }
        }
      },
      'Ghaziabad': {
        cities: {
          'Ghaziabad': {
            mandals: {
              'Ghaziabad Urban': ['Indirapuram', 'Vaishali', 'Vasundhara', 'Raj Nagar Extension', 'Crossings Republik']
            }
          }
        }
      }
    }
  },
  'Gujarat': {
    districts: {
      'Ahmedabad': {
        cities: {
          'Ahmedabad': {
            mandals: {
              'Ahmedabad Urban': ['SG Highway', 'Prahlad Nagar', 'Bodakdev', 'Satellite', 'Vastrapur', 'Bopal', 'South Bopal', 'Chandkheda', 'Navrangpura']
            }
          }
        }
      },
      'Surat': {
        cities: {
          'Surat': {
            mandals: {
              'Surat Urban': ['Vesu', 'Adajan', 'Piplod', 'Ghopad Rod', 'Varachha']
            }
          }
        }
      },
      'Vadodara': {
        cities: {
          'Vadodara': {
            mandals: {
              'Vadodara Urban': ['Alkapuri', 'Gotri', 'Vasna Road', 'Manjalpur', 'Bhayli']
            }
          }
        }
      }
    }
  },
  'Uttar Pradesh': {
    districts: {
      'Lucknow': {
        cities: {
          'Lucknow': {
            mandals: {
              'Lucknow Urban': ['Gomti Nagar', 'Gomti Nagar Extension', 'Hazratganj', 'Indira Nagar', 'Alambagh', 'Mahanagar', 'Sushant Golf City']
            }
          }
        }
      },
      'Kanpur Nagar': {
        cities: {
          'Kanpur': {
            mandals: {
              'Kanpur Urban': ['Civil Lines', 'Swaroop Nagar', 'Kidwai Nagar', 'Kalyanpur']
            }
          }
        }
      },
      'Varanasi': {
        cities: {
          'Varanasi': {
            mandals: {
              'Varanasi Urban': ['Lanka', 'Sigra', 'Godowlia', 'Cantonment', 'Shivpur']
            }
          }
        }
      }
    }
  },
  'West Bengal': {
    districts: {
      'Kolkata': {
        cities: {
          'Kolkata': {
            mandals: {
              'Kolkata Urban': ['Salt Lake (Bidhannagar)', 'New Town (Rajarhat)', 'Alipore', 'Ballygunge', 'Park Street', 'Tollygunge', 'Garia', 'Dum Dum']
            }
          }
        }
      }
    }
  },
  'Kerala': {
    districts: {
      'Ernakulam': {
        cities: {
          'Kochi': {
            mandals: {
              'Kochi Urban': ['Kakkanad (InfoPark Area)', 'Edappally', 'Marine Drive', 'Aluva', 'Vyttila', 'Palarivattom', 'Panampilly Nagar']
            }
          }
        }
      },
      'Thiruvananthapuram': {
        cities: {
          'Thiruvananthapuram': {
            mandals: {
              'Trivandrum Urban': ['Technopark Kazhakkoottam', 'Kowdiar', 'Pattom', 'Vazhuthacaud', 'Palayam']
            }
          }
        }
      }
    }
  },
  'Rajasthan': {
    districts: {
      'Jaipur': {
        cities: {
          'Jaipur': {
            mandals: {
              'Jaipur Urban': ['Malviya Nagar', 'Vaishali Nagar', 'C-Scheme', 'Mansarovar', 'Jagatpura', 'Raja Park', 'Tonk Road']
            }
          }
        }
      }
    }
  },
  'Punjab': {
    districts: {
      'SAS Nagar (Mohali)': {
        cities: {
          'Mohali': {
            mandals: {
              'Mohali Urban': ['Sector 70', 'Sector 82', 'Sector 115', 'Aerocity', 'JLPL Industrial Area']
            }
          }
        }
      }
    }
  },
  'Chandigarh': {
    districts: {
      'Chandigarh': {
        cities: {
          'Chandigarh': {
            mandals: {
              'Chandigarh UT': ['Sector 17', 'Sector 35', 'Sector 8', 'Sector 22', 'Manimajra']
            }
          }
        }
      }
    }
  },
  'Goa': {
    districts: {
      'North Goa': {
        cities: {
          'Panaji / Bardez': ['Panaji City', 'Candolim', 'Calangute', 'Porvorim', 'Mapusa', 'Anjuna']
        }
      },
      'South Goa': {
        cities: {
          'Margao / Salcete': ['Margao', 'Vasco da Gama', 'Colva', 'Benaulim']
        }
      }
    }
  }
};

/** Get sorted array of all available States/UTs */
export function getStatesList() {
  const states = Object.keys(INDIA_LOCATION_DATA).sort();
  return states;
}

/** Get sorted array of Districts for a given State */
export function getDistrictsList(stateName) {
  if (!stateName || !INDIA_LOCATION_DATA[stateName]) return [];
  return Object.keys(INDIA_LOCATION_DATA[stateName].districts).sort();
}

/** Get sorted array of Cities/Towns for a given State & District */
export function getCitiesList(stateName, districtName) {
  if (!stateName || !districtName) return [];
  const distObj = INDIA_LOCATION_DATA[stateName]?.districts[districtName];
  if (!distObj || !distObj.cities) return [];
  return Object.keys(distObj.cities).sort();
}

/** Get sorted array of Mandals/Tehsils for a given State, District & City */
export function getMandalsList(stateName, districtName, cityName) {
  if (!stateName || !districtName || !cityName) return [];
  const cityObj = INDIA_LOCATION_DATA[stateName]?.districts[districtName]?.cities[cityName];
  if (!cityObj || !cityObj.mandals) return [];
  return Object.keys(cityObj.mandals).sort();
}

/** Get sorted array of Localities for a given State, District, City & Mandal */
export function getLocalitiesList(stateName, districtName, cityName, mandalName) {
  if (!stateName || !districtName || !cityName || !mandalName) return [];
  const mandalArray = INDIA_LOCATION_DATA[stateName]?.districts[districtName]?.cities[cityName]?.mandals[mandalName];
  if (!Array.isArray(mandalArray)) return [];
  return [...mandalArray].sort();
}
