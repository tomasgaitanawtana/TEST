const axios = require('axios');
const querystring = require('querystring');
const { DynamoDBClient, PutItemCommand ,GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { access } = require('fs');

const TABLE_NAME = process.env.TABLE_NAME;

async function addAccessTokenToDynamoDB(accessToken,userId,expiresIn,refreshToken) {

    const client = new DynamoDBClient();
  
    try {
      const currentDate = new Date().toISOString();
      const expirationTime = new Date(new Date().getTime() + expiresIn * 1000 * 0.75);

      const putItemInput = {
        TableName: TABLE_NAME,
        Item: {
          'pk': {'S': userId.toString(),},
          'sk': {'S': 'NO_ESPECIFICADO'},
          'HubID': { 'S': accessToken },
          'client_id': { 'S': process.env.CLIENT_ID },
          'client_secret': { 'S': process.env.CLIENT_SECRET },
          'date_created': { 'S': currentDate},
          'status': { 'S': 'INSTALADO'},
          'expires_at': { 'S': expirationTime.toISOString() },
          'refresh_token': { 'S': refreshToken },
        }
      };
  
      await client.send(new PutItemCommand(putItemInput));

      const getItemInput = {
        TableName: TABLE_NAME,
        Key: {
          'pk': { 'S': userId.toString() },
          'sk': {'S': 'NO_ESPECIFICADO'},
        }
      };

      const getItemOutput = await client.send(new GetItemCommand(getItemInput));

      const addedItem = getItemOutput.Item;

      if (addedItem) {
        console.log('Datos agregados correctamente:');

        return true;
      } else {
        console.error('Error: No se pudo recuperar el elemento agregado.');
        return false;
      }

    } catch (error) {
      console.error('Error al agregar datos:', error);
      return false;
    }
  }

async function getProperty(propertyKey,accessToken) {
  try {
    const response = await axios.get(
      `https://api.hubspot.com/crm/v3/properties/contacts/named/${propertyKey}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.results[propertyKey];
  } catch (error) {
    if (error.response.status === 404) {
      return null; // La propiedad no existe
    }
    throw error;
  }
}

async function createDealProperty(propertyData,accessToken) {

  try {

    const propertyKey = propertyData.name;
    const existingProperty = await getProperty(propertyKey,accessToken);

    if (!existingProperty) {
      await axios.post(
        "https://api.hubspot.com/crm/v3/properties/deals",
        propertyData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            groupName: propertyData.groupName, // Agregar el nombre del grupo como parámetro
          },
        }
      );

      console.log("Propiedad de negocio creada:", propertyKey);
    }  else {
      console.log("La propiedad de negocio ya existe:", existingProperty);
      //await sendEmail(existingProperty);
    }
  } catch (error) {
      console.error( "Error al crear propiedad de negocio:", error ); 
  }
}

async function createQuoteProperty(propertyData,accessToken) {
  try {
    console.log('accestoken -> ',accessToken);
    const propertyKey = propertyData.name;
    const existingProperty = await getProperty(propertyKey,accessToken);

    if (!existingProperty) {
      await axios.post(
        "https://api.hubspot.com/crm/v3/properties/quotes",
        propertyData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            groupName: propertyData.groupName, // Agregar el nombre del grupo como parámetro
          },
        }
      );

      console.log("Propiedad de cotización creada:", propertyKey);
    } else {
      console.log("La propiedad de cotizaciones ya existe:", existingProperty);
    } 
  } catch (error) {
    console.error(
      "Error al crear propiedad de cotización:",
      error
    );
  }
}

async function createLineItemProperty(propertyData,accessToken) {
  try {
    console.log('accestoken -> ',accessToken);
    const propertyKey = propertyData.name;
    const existingProperty = await getProperty(propertyKey,accessToken);

    if (!existingProperty) {
      await axios.post(
        "https://api.hubspot.com/crm/v3/properties/line_item",
        propertyData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            groupName: propertyData.groupName, // Agregar el nombre del grupo como parámetro
          },
        }
      );

      console.log("Propiedad de Line Item creada:", propertyKey);
    }  else {
      console.log("La propiedad de Line Item ya existe:", existingProperty);
    } 
  } catch (error) {
    console.error(
      "Error al crear propiedad de Line Item:",
      error
    );
  }
}

async function createProductProperties(propertyData,accessToken) {
  try {
    console.log('accestoken -> ',accessToken);
    const propertyKey = propertyData.name;
    const existingProperty = await getProperty(propertyKey,accessToken);

    if (!existingProperty) {
      await axios.post(
        "https://api.hubspot.com/crm/v3/properties/product",
        propertyData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            groupName: propertyData.groupName, // Agregar el nombre del grupo como parámetro
          },
        }
      );

      console.log("Propiedad de Producto creada:", propertyKey);
    } else {
      console.log("La propiedad de Line Item ya existe:", existingProperty);
    }
  } catch (error) {
    console.error(
      "Error al crear propiedad de Line Item:",
      error
    );
  }
}

async function createContactProperty(propertyData,accessToken) {
  try {
    console.log('accestoken -> ',accessToken);
    const propertyKey = propertyData.name;
    const existingProperty = await getProperty(propertyKey,accessToken);

    if (!existingProperty) {
      await axios.post(
        "https://api.hubspot.com/crm/v3/properties/contacts",
        propertyData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            groupName: propertyData.groupName, // Agregar el nombre del grupo como parámetro
          },
        }
      );

      console.log("Propiedad de contacto creada:", propertyKey);
    }  else {
      console.log("La propiedad de contacto ya existe:", existingProperty);
    } 
  } catch (error) {
    console.log("Error al crear propiedad de contacto:", error.response.data.message); 
    //await sendEmail(error);
  }
}

module.exports.process = async (event) => {

    let accessToken;

    let extractedName;

    console.log('evento para procesar',event);

    const queryStringParameters = event.queryStringParameters

    if (!queryStringParameters || !queryStringParameters.code) {
        return {
            statusCode: 400,
            body: 'Missing authorization code in the query parameters.',
        };
    }

    const code = queryStringParameters.code;
    let userId;

    // Intercambia el código de autorización por un token de acceso
    const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
    const data = {
        grant_type: 'authorization_code',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
        code: code,
    };

    try {

        const response = await axios.post(tokenUrl, querystring.stringify(data), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        });

        accessToken = response.data.access_token;
        const expiresIn = response.data.expires_in;
        const refreshToken = response.data.refresh_token;

        console.log('AccessToken',accessToken);
        console.log('ExpiresIn',expiresIn);
        console.log('refresh_token',refreshToken);

        //Creacion de propiedades

        try{

          const checkAndCreatePropertyGroup = async (groupName, groupLabel, displayOrder) => {
            try {
              console.log('Creando los grupos de propiedades');
              console.log('groupName', groupName);
              console.log('groupLabel', groupLabel);
              console.log('displayOrder', displayOrder);
          
              function extractGroupName(groupName) {
                const match = groupName.match(/^([a-zA-Z-_]+)-edvisor$/);
                return match ? match[1] : null;
              }
          
              const extractedName = extractGroupName(groupName);
          
              console.log('extractedName', extractedName);
          
              const checkProperties = await axios.get(
                `https://api.hubspot.com/crm/v3/properties/${extractedName}/groups`,
                {
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              );
          
              if (checkProperties.data.results && checkProperties.data.results.length > 0) {
                console.log('checkProperties', checkProperties.data.results[0]);
          
                // Verificar si el grupo ya existe
                const groupExists = checkProperties.data.results.some(group => group.name === groupName);
          
                console.log('groupExists', groupExists);
          
                if (!groupExists) {
                  console.log('El grupo de propiedades no existe');
                  // Crear el grupo de propiedades si no existe
                  const groupProperties = {
                    name: groupName,
                    label: groupLabel,
                    displayOrder: displayOrder,
                  };
          
                  const createGroupProperties = await axios.post(
                    `https://api.hubspot.com/crm/v3/properties/${extractedName}/groups`,
                    groupProperties,
                    {
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                      },
                    }
                  );
          
                  console.log(`Grupo de propiedades "${groupName}" creado`);
                } else {
                  console.log(`El grupo de propiedades "${groupName}" ya existe`);
                }
              } else {
                console.error('Error al obtener propiedades del grupo:', 'No se recibieron datos válidos');
              }
            } catch (error) {
              console.error(`Error al crear o verificar el grupo de propiedades "${groupName}":`, error.response ? error.response.data : error.message);
            }
          };
          
          console.log('-Contacts-');
          checkAndCreatePropertyGroup('contacts-edvisor', 'Edvisor Contact Properties', 0);
          
          console.log('-Quotes-');
          checkAndCreatePropertyGroup('quotes-edvisor', 'Edvisor Quotes Properties', 0);
          
          console.log('-Deal-');
          checkAndCreatePropertyGroup('deal-edvisor', 'Edvisor Deal Properties', 0);
          
          console.log('-Line-Items-');
          checkAndCreatePropertyGroup('line_items-edvisor', 'Edvisor Line Item Properties ', 0);
          
          console.log('-Products-');
          checkAndCreatePropertyGroup('products-edvisor', 'Edvisor Product Properties', 0);
          
      
          const dealProperties = [
            {
              name: "statusdealedvisor",
              label: "statusDealEdvisor",
              type: "enumeration",
              fieldType: "select",
              groupName: "deal-edvisor",
              displayOrder: 2,
              options: [
                {
                  label: "true",
                  description: "Choice number one",
                  value: "true",
                  displayOrder: 1,
                  hidden: false,
                },
                {
                  label: "false",
                  description: "Choice number two",
                  value: "false",
                  displayOrder: 2,
                  hidden: false,
                },
              ],
            },
            {
              name: "studentquoteid",
              label: "studentQuoteId",
              type: "string",
              fieldType: "text",
              groupName: "deal-edvisor",
            },
            {
              name: "studentid",
              label: "studentId",
              type: "string",
              fieldType: "text",
              groupName: "deal-edvisor",
            },
            {
              name: "is_deleted",
              label: "is_deleted",
              type: "enumeration",
              fieldType: "select",
              groupName: "deal-edvisor",
              displayOrder: 2,
              options: [
                {
                  label: "true",
                  description: "Choice number one",
                  value: "true",
                  displayOrder: 1,
                  hidden: false,
                },
                {
                  label: "false",
                  description: "Choice number two",
                  value: "false",
                  displayOrder: 2,
                  hidden: false,
                },
              ],
            },
            {
              name: "quote_option_id_1",
              label: "quote_option_id_1",
              type: "string",
              fieldType: "text",
              groupName: "deal-edvisor",
            },
            {
              name: "quote_option_id_2",
              label: "quote_option_id_2",
              type: "string",
              fieldType: "text",
              groupName: "deal-edvisor",
            },
            {
              name: "quote_option_id_3",
              label: "quote_option_id_3",
              type: "string",
              fieldType: "text",
              groupName: "deal-edvisor",
            },
            {
              name: "quote_option_id_4",
              label: "quote_option_id_4",
              type: "string",
              fieldType: "text",
              groupName: "deal-edvisor",
            },
            {
              name: "quote_option_id_5",
              label: "quote_option_id_5",
              type: "string",
              fieldType: "text",
              groupName: "deal-edvisor",
            },
            {
              name: "quote_option_id_6",
              label: "quote_option_id_6",
              type: "string",
              fieldType: "text",
              groupName: "deal-edvisor",
            },
            {
              name: "quoteaccepted",
              label: "quoteaccepted",
              type: "string",
              fieldType: "text",
              groupName: "deal-edvisor",
            },
            {
              name: "currency_2",
              label: "currency_2",
              type: "string",
              fieldType: "text",
              groupName: "deal-edvisor",
            },
            {
              name: "price",
              label: "price",
              type: "string",
              fieldType: "text",
              groupName: "deal-edvisor",
            }
          ];
      
          const quoteProperties = [
            {
              name: "studentquoteid",
              label: "studentQuoteId",
              type: "string",
              fieldType: "text",
              groupName: "quotes-edvisor",
            },
          ];
      
          const line_itemProperties = [
            {
              name: "studentquoteid",
              label: "studentQuoteId",
              type: "string",
              fieldType: "text",
              groupName: "line_items-edvisor",
            },
          ];
      
          const productProperties = [
            {
              name: "product_category",
              label: "Categoria del producto",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
            {
              name: "institution",
              label: "Institucion",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
            {
              name: "program",
              label: "Programa",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
            {
              name: "duration",
              label: "Duracion",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
            {
              name: "start_date",
              label: "Fecha de comienzo",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
            {
              name: "end_date",
              label: "Fecha Fin",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
            {
              name: "option_number",
              label: "Numero de opcion",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
            {
              name: "name_edvisor",
              label: "Nombre en Edvisor",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
            {
              name: "address",
              label: "address",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
            {
              name: "hubspot_id",
              label: "hubspot_id",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
            {
              name: "institution",
              label: "institution",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
            {
              name: "duration_type",
              label: "duration_type",
              type: "string",
              fieldType: "text",
              groupName: "products-edvisor",
            },
          ];

          const countries = ["Andorra", "United Arab Emirates", "Afghanistan", "Antigua and Barbuda", "Anguilla", "Albania", "Armenia", "Angola", "Antarctica", "Argentina", "American Samoa", "Austria", "Australia", "Aruba", "Azerbaijan", "Bosnia and Herzegovina", "Barbados", "Bangladesh", "Belgium", "Burkina Faso", "Bulgaria", "Bahrain", "Burundi", "Benin", "Bermuda", "Brunei", "Bolivia", "Bonaire, Sint Eustatius and Saba", "Brazil", "The Bahamas", "Bhutan", "Botswana", "Belarus", "Belize", "Canada", "Cocos (Keeling) Islands", "Congo 2", "Central African Republic", "Congo", "Switzerland", "CÃƒÂ´te d'Ivoire", "Cook Islands", "Chile", "Cameroon", "China", "Colombia", "Costa Rica", "Cuba", "Cape Verde", "CuraÃƒÂ§ao", "Christmas Island", "Cyprus", "Czech Republic", "Germany", "Djibouti", "Denmark", "Dominica", "Dominican Republic", "Algeria", "Ecuador", "Estonia", "Egypt", "Eritrea", "Spain", "Ethiopia", "Finland", "Fiji", "Micronesia", "Faroe Islands", "France", "Gabon", "United Kingdom", "Grenada", "Georgia", "French Guiana", "Guernsey", "Ghana", "Gibraltar", "Greenland", "Gambia", "Guinea", "Guadeloupe", "Equatorial Guinea", "Greece", "Guatemala", "Guam", "Guinea-Bissau", "Guyana", "Hong Kong", "Honduras", "Croatia", "Haiti", "Hungary", "Indonesia", "Ireland", "Israel", "Isle of Man", "India", "Iraq", "Iran", "Iceland", "Italy", "Jersey", "Jamaica", "Jordan", "Japan", "Kenya", "Kyrgyzstan", "Cambodia", "Kiribati", "Comoros", "Saint Kitts and Nevis", "North Korea", "South Korea", "Kuwait", "Cayman Islands", "Kazakhstan", "Laos", "Lebanon", "Saint Lucia", "Liechtenstein", "Sri Lanka", "Liberia", "Lesotho", "Lithuania", "Luxembourg", "Latvia", "Libya", "Morocco", "Monaco", "Moldova", "Montenegro", "Madagascar", "Marshall Islands", "Macedonia", "Mali", "Myanmar", "Mongolia", "Macao", "Northern Mariana Islands", "Martinique", "Mauritania", "Montserrat", "Malta", "Mauritius", "Maldives", "Malawi", "Mexico", "Malaysia", "Mozambique", "Namibia", "New Caledonia", "Niger", "Norfolk Island", "Nigeria", "Nicaragua", "Netherlands", "Norway", "Nepal", "Nauru", "Niue", "New Zealand", "Oman", "Panama", "Peru", "French Polynesia", "Papua New Guinea", "Philippines", "Pakistan", "Poland", "Pitcairn", "Puerto Rico", "Palestine", "Portugal", "Palau", "Paraguay", "Qatar", "RÃƒÂ©union", "Romania", "Serbia 2", "Russia", "Rwanda", "Saudi Arabia", "Solomon Islands", "Seychelles", "Sudan", "Sweden", "Singapore", "Slovenia", "Slovakia", "Sierra Leone", "San Marino", "Senegal", "Somalia", "Suriname", "South Sudan", "Sao Tome and Principe", "El Salvador", "Sint Maarten (dutch Part)", "Syria", "Swaziland", "Turks and Caicos Islands", "Chad", "Togo", "Thailand", "Tajikistan", "Tokelau", "Timor-Leste", "Turkmenistan", "Tunisia", "Tonga", "Turkey", "Trinidad and Tobago", "Tuvalu", "Taiwan", "Tanzania", "Ukraine", "Uganda", "United States", "Uruguay", "Uzbekistan", "Holy See (Vatican City State)", "Saint Vincent and The Grenadines", "Venezuela", "British Virgin Islands", "US Virgin Islands", "Vietnam", "Vanuatu", "Wallis and Futuna", "Samoa", "Serbia", "Yemen", "Mayotte", "South Africa", "Zambia", "Zimbabwe", "United States Minor Outlying Islands", "British Indian Ocean Territory"];
          

          const contactProperties = [
            {
              name: "studentid",
              label: "studentId",
              type: "string",
              fieldType: "text",
              groupName: "contacts-edvisor",
            },
            {
              name: "hsportalid",
              label: "hsportalid",
              type: "string",
              fieldType: "text",
              groupName: "contacts-edvisor",
            },
            {
              name: "fecha_nacimiento",
              label: "Fecha Nacimiento",
              type: "datetime",
              fieldType: "date",
              groupName: "contacts-edvisor",
            },/* ,
            {
              name: "id_agency",
              label: "ID de Agencia",
              type: "enumeration",
              fieldType: "select",
              groupName: "contacts-edvisor",
              displayOrder: 4,
              options: [],
            }, */
            {
              name: "is_deleted",
              label: "is_deleted",
              type: "enumeration",
              fieldType: "select",
              groupName: "contacts-edvisor",
              displayOrder: 2,
              options: [
                {
                  label: "true",
                  description: "Choice number one",
                  value: "true",
                  displayOrder: 1,
                  hidden: false,
                },
                {
                  label: "false",
                  description: "Choice number two",
                  value: "false",
                  displayOrder: 2,
                  hidden: false,
                },
              ],
            },
            {
              name: "countryhs",
              label: "countryhs",
              type: "enumeration",
              fieldType: "select",
              groupName: "contacts-edvisor",
              displayOrder: 3, 
              options: countries.map((country, index) => ({
                label: country,
                description: `Choice number ${index + 1}`,
                value: `${index + 1}`,
                displayOrder: index + 1,
                hidden: false,
              })),
            },
          ];

          console.log('contactProperties',contactProperties);

          console.log("FIN");
      
          for (const propertyData of [
            ...dealProperties,
            ...quoteProperties,
            ...line_itemProperties,
            ...productProperties,
            ...contactProperties,
          ]) {
            if (propertyData.groupName === "deal-edvisor") {
              await createDealProperty(propertyData,accessToken);
            } else if (propertyData.groupName === "quotes-edvisor") {
              await createQuoteProperty(propertyData,accessToken);
            } else if (propertyData.groupName === "line_items-edvisor") {
              await createLineItemProperty(propertyData,accessToken);
            } else if (propertyData.groupName === "products-edvisor") {
              await createProductProperties(propertyData,accessToken);
            } else if (propertyData.groupName === "contacts-edvisor") {
              await createContactProperty(propertyData,accessToken);
            }
          }
        } catch(error){
          console.error('Error al crear una o mas propiedades',error)
        }

        try {

            const hubspotUserId = await axios.get('https://api.hubapi.com/integrations/v1/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
            });

            userId = hubspotUserId.data.portalId;

        } catch(error){
            console.error('Error al obtener PortalID de HubSpot',error)
        }

        const accessTokenAdded = await addAccessTokenToDynamoDB(accessToken,userId,expiresIn,refreshToken);

        if (!accessTokenAdded) {
          return {
            statusCode: 302,
            headers: {
                'Location': process.env.REDIRECT_URL_ERROR,
            },
          };
        }

        return {
            statusCode: 302, // 302 es el código de redirección temporal
            headers: {
              'Location': `${process.env.REDIRECT_URL}?token=${accessToken}`, // Especifica la URL de redirección
            },
          };

    } catch (error) {
        console.error('Error al intercambiar el código de autorización por un token de acceso:', error);

        return {
            statusCode: 302,
            headers: {
                'Location': process.env.REDIRECT_URL_ERROR,
            },
        }
    }
} 

