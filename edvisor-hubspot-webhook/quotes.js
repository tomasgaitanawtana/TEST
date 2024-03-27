const axios = require("axios");

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");

const querystring = require("querystring");

/* const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sendEmail = async (error) => {
  const client = new SESClient();
  const command = new SendEmailCommand({
    Source: 'apps@awtana.com',
    Destination: {
      ToAddresses: [
        'miguel.gallo@awtana.com',
        'tomas.gaitan@awtana.com'
      ]
    },
    Message: {
      Subject: {
        Data: 'Error en la aplicación',
        Charset: 'UTF-8'
      },
      Body: {
        Text: {
          Data: `Se ha producido un error:\n\n${error.message}`,
          Charset: 'UTF-8'
        }
      }
    }
  });
​
  try {
    const response = await client.send(command);
    console.log(JSON.stringify(response, null, 2));
  } catch (sesError) {
    console.error(`Error al enviar el correo SES: ${sesError.message}`);
  }
};  */

let hubspotApiKey;
let edvisorAuthToken;
let id_agencia;
let agencyId;
let PIPELINE;
let DEALSTAGE;
let TEMPLATE_ID;
let portalIdtoSearch;
let agencyCompanyId;

const edvisorApiUrl = "https://api.edvisor.io/graphql";
const TABLE_NAME = process.env.TABLE_NAME;
const TABLE_NAME_TOKEN = process.env.TABLE_NAME_TOKEN;

async function updateTokenInDynamoDB(
  portalIdtoSearch,
  accessToken,
  expiresIn,
  refreshToken
) {
  const client = new DynamoDBClient();

  try {
    console.log("...updateTokenInDynamoDB...");
    console.log("portalIdtoSearch", portalIdtoSearch);
    console.log("accessToken", accessToken);
    console.log("expiresIn", expiresIn);
    console.log("refreshToken", refreshToken);

    const expirationTime = new Date(
      new Date().getTime() + expiresIn * 1000 * 0.75
    );

    const updateItemInput = {
      TableName: TABLE_NAME_TOKEN,
      Key: {
        pk: { S: portalIdtoSearch.toString() },
        sk: { S: 'NO_ESPECIFICADO'}
      },
      UpdateExpression:
        "SET HubID = :accessToken, expires_at = :expirationTime, refresh_token = :refreshToken",
      ExpressionAttributeValues: {
        ":accessToken": { S: accessToken },
        ":expirationTime": { S: expirationTime.toISOString() },
        ":refreshToken": { S: refreshToken },
      },
    };

    console.log("datos para actulizar en la table", updateItemInput);

    await client.send(new UpdateItemCommand(updateItemInput));

    console.log("Token actualizado correctamente en DynamoDB.");

    return accessToken;
  } catch (error) {
    console.error("Error al actualizar el token en DynamoDB:", error);
  }
}

//Codigo anterior
/* 
async function getAccessToken(agencyCompanyId) {
  const client = new DynamoDBClient();
  let newAccessToken;

  try {
    const scanInput = {
      TableName: TABLE_NAME_TOKEN,
    };

    const scanResponse = await client.send(new ScanCommand(scanInput));

    console.log('ScanResponse',scanResponse);

    console.log('ScanResponse',scanResponse.Items);

    if (scanResponse.Items && scanResponse.Items.length > 0) {
      const matchingItem = scanResponse.Items.find((item) =>
        item.agencyCompanyId.S === agencyCompanyId
      );

      if (matchingItem && matchingItem.expires_at) {
        const expirationTime = new Date(matchingItem.expires_at.S);
        edvisorAuthToken = matchingItem.edvisor_token.S;
        id_agencia = matchingItem.id_agency_default.S;
        portalIdtoSearch = matchingItem.pk.S;
        TEMPLATE_ID = matchingItem.template_id.S;
        PIPELINE = matchingItem.pipeline.S;
        DEALSTAGE = matchingItem.dealstage.S;

        if (expirationTime.getTime() < Date.now()) {
          console.log("la fecha de expiracion esta vencida");
          const refreshToken = matchingItem.refresh_token.S;

          console.log("Refresh_token anterior", refreshToken);
          console.log("Acces_token anterior", matchingItem.HubID.S);
          console.log("Expires_at anterior", matchingItem.expires_at.S);

          // Realizar la solicitud de refresco del token utilizando el refreshToken
          const tokenUrl = "https://api.hubapi.com/oauth/v1/token";
          const data = {
            grant_type: "refresh_token",
            client_id: matchingItem.client_id.S,
            client_secret: matchingItem.client_secret.S,
            refresh_token: refreshToken,
          };

          let newExpiresIn;
          let newRefreshToken;

          try {
            console.log("Por actualizar refresh_token...");
            console.log("Datos de la solicitud:", data);

            const refreshResponse = await axios.post(
              tokenUrl,
              querystring.stringify(data),
              {
                headers: {
                  "Content-Type":
                    "application/x-www-form-urlencoded;charset=utf-8",
                },
              }
            );

            console.log("Respuesta del servidor:", refreshResponse.data);

            newAccessToken = refreshResponse.data.access_token;
            newExpiresIn = refreshResponse.data.expires_in;
            newRefreshToken = refreshResponse.data.refresh_token;

            console.log("Nuevo AccessToken", newAccessToken);
            console.log("Nuevo ExpiresIn", newExpiresIn);
            console.log("Nuevo RefreshToken", newRefreshToken);
          } catch (error) {
            // Manejar el error
            console.error("Error en la solicitud POST:", error);
          }

          console.log(
            "Actualizando accesstoken,expiresIn y refreshToken en DynamoDB"
          );
          // Actualizar el token y la fecha de expiración en DynamoDB
          const accessTokenDynamo = await updateTokenInDynamoDB(
            portalIdtoSearch,
            newAccessToken,
            newExpiresIn,
            newRefreshToken
          );

          return accessTokenDynamo;
        } else {
          console.log("la fecha de expiracion se encuentra vigente");
          return matchingItem.HubID.S;
        }
      } else {
        console.log("No se encontró el accessToken en DynamoDB.");
        return null;
      }
    } else {
      console.log("No se encontró el accessToken en DynamoDB.");
      return null;
    }
  } catch (error) {
    console.error("Error al obtener el accessToken:", error);
    return null;
  }
}
*/

async function getAccessToken(agencyCompanyId) {
  const client = new DynamoDBClient();
  let newAccessToken;

  try {

    const queryInput = {
      TableName: TABLE_NAME_TOKEN,
      IndexName: "agencyCompanyId-index", 
      KeyConditionExpression: "agencyCompanyId = :agencyCompanyId",
      ExpressionAttributeValues: {
        ":agencyCompanyId": { S: agencyCompanyId }, //
      },
    };

    const queryResponse = await client.send(new QueryCommand(queryInput));

    console.log('queryResponse.Items',queryResponse.Items);

    if (queryResponse.Items && queryResponse.Items.length > 0) {

      const matchingItem = queryResponse.Items[0];

      if (matchingItem && matchingItem.expires_at) {

        const expirationTime = new Date(matchingItem.expires_at.S);

        edvisorAuthToken = matchingItem.edvisor_token.S;
        id_agencia = matchingItem.id_agency_default.S;
        portalIdtoSearch = matchingItem.pk.S;
        TEMPLATE_ID = matchingItem.template_id.S;
        PIPELINE = matchingItem.pipeline.S;
        DEALSTAGE = matchingItem.dealstage.S;

        if (expirationTime.getTime() < Date.now()) {
          console.log("la fecha de expiracion esta vencida");
          const refreshToken = matchingItem.refresh_token.S;

          // Realizar la solicitud de refresco del token utilizando el refreshToken
          const tokenUrl = "https://api.hubapi.com/oauth/v1/token";
          const data = {
            grant_type: "refresh_token",
            client_id: matchingItem.client_id.S,
            client_secret: matchingItem.client_secret.S,
            refresh_token: refreshToken,
          };

          let newExpiresIn;
          let newRefreshToken;

          try {
            console.log("Por actualizar refresh_token...");
            console.log("Datos de la solicitud:", data);

            const refreshResponse = await axios.post(
              tokenUrl,
              querystring.stringify(data),
              {
                headers: {
                  "Content-Type":
                    "application/x-www-form-urlencoded;charset=utf-8",
                },
              }
            );

            console.log("Respuesta del servidor:", refreshResponse.data);

            newAccessToken = refreshResponse.data.access_token;
            newExpiresIn = refreshResponse.data.expires_in;
            newRefreshToken = refreshResponse.data.refresh_token;

            console.log("Nuevo AccessToken", newAccessToken);
            console.log("Nuevo ExpiresIn", newExpiresIn);
            console.log("Nuevo RefreshToken", newRefreshToken);
          } catch (error) {
            // Manejar el error
            console.error("Error en la solicitud POST:", error);
          }

          console.log(
            "Actualizando accesstoken,expiresIn y refreshToken en DynamoDB"
          );
          // Actualizar el token y la fecha de expiración en DynamoDB
          const accessTokenDynamo = await updateTokenInDynamoDB(
            portalIdtoSearch,
            newAccessToken,
            newExpiresIn,
            newRefreshToken
          );

          return accessTokenDynamo;
        } else {
          console.log("la fecha de expiracion se encuentra vigente");
          return matchingItem.HubID.S;
        }
      } else {
        console.log("No se encontró el accessToken en DynamoDB.");
        return null;
      }
    } else {
      console.log("No se encontró el accessToken en DynamoDB.");
      return null;
    }
  } catch (error) {
    console.error("Error al obtener el accessToken:", error);
    return null;
  }
}

async function getEdvisorOwner(
  agencyIdToSearch,
  ownerToSearch,
  portalIDToSearch
) {
  console.log("entro al buscador de getEdvisorOwner");

  console.log("agencyIdToSearch", agencyIdToSearch);
  console.log("ownerToSearch", ownerToSearch);
  console.log("portalIDToSearch", portalIDToSearch);

  const client = new DynamoDBClient();

  const input = {
    TableName: TABLE_NAME,
    Key: {
      pk: { S: agencyIdToSearch },
      sk: { S: portalIDToSearch },
    },
  };

  const command = new GetItemCommand(input);

  console.log("command", command);

  try {
    console.log("antes de entrar al response");

    const response = await client.send(command);

    console.log("response 1", response);

    if (response.Item) {
      const item = response.Item;
      const agents = item.agents.L;
      /* const agents = JSON.parse(item.agents.S); */

      for (const agent of agents) {
        const edVisorId = agent.M.userId.N;

        if (parseInt(edVisorId) === parseInt(ownerToSearch)) {
          console.log("coincidieron ", edVisorId, " y ", ownerToSearch);
          return agent.M.hubspot_owner_id.S;
        }
      }
      console.log("no se encontro el propietario");
      return null;
    } else {
      console.log("La respuesta de DynamoDB no tiene la estructura esperada.");
      return null;
    }
  } catch (error) {
    console.error("Error al obtener el item:", error);
    return null;
  }
}

module.exports.receive = async (event) => {
  console.log("evento recibido", event);

  const eventBody = event.body;
  const other = event.pathParameters;

  const client = new LambdaClient({});
  const input = {
    FunctionName: process.env.FUNCTION_NAME,
    InvocationType: "Event",
    Payload: JSON.stringify({ eventBody, other }),
  };
  const command = new InvokeCommand(input);
  const response = await client.send(command);
  console.log(JSON.stringify(response));

  return {
    statusCode: 200,
    body: "Event received successfully!",
  };
};

module.exports.process = async (event) => {
  console.log(event);

  console.log("--- Process event---", event);

  const body = JSON.parse(event.eventBody);
  const agencyParameters = event.other;

  console.log("Body", body);
  console.log("AgencyCompanyId", agencyParameters.agency);

  agencyCompanyId = agencyParameters.agency;

  try {
    const eventData = body.data;
    const eventType = body.type;
    
    const refreshToken = await getAccessToken(agencyCompanyId);

    if (!refreshToken) {
      return "No se encontró el AgencyID en DynamoDB.";
    } else {
      hubspotApiKey = refreshToken;

      console.log("hubspotApiKey", hubspotApiKey);
    }

    //Creacion del negocio con asociación de contacto ✅
    if (eventType === "studentQuote:create") {
      try {
 
        console.log('Creacion');

        console.log("quoteId", eventData.after.studentQuoteId);
        console.log("studentId", eventData.after.studentId);
        console.log("agentId", eventData.after.agentUserId);
        console.log("notes", eventData.after.notes);
        console.log("fecha de creacion", eventData.after.created);

        
        const studentQuoteId = eventData.after.studentQuoteId;
        const titleQuote = eventData.after.externalId;
        const studentId = eventData.after.studentId;
        const agentId = eventData.after.agentUserId;

        console.log('agencyCompanyId',agencyCompanyId);

        /* try {
          const refreshToken = await getAccessToken(agencyCompanyId);

          if (!refreshToken) {
            return "No se encontró el AgencyID en DynamoDB.";
          } else {
            hubspotApiKey = refreshToken;

            console.log("hubspotApiKey", hubspotApiKey);
          }
        } catch (error) {
          console.error("Error durante la ejecución:", error);
        } */

        console.log('edvisorAuthToken',edvisorAuthToken);

        const getAgency = await axios.post(
          edvisorApiUrl,
          {
            query: `
            query{
              student(studentId:${studentId}){
                agencyId
                metadata
              }
            }
            `,
          },
          {
            headers: {
              Authorization: `Bearer ${edvisorAuthToken}`,
            },
          }
        );

        agencyId = getAgency.data.data.student.agencyId;

        //End

        //FIND CONTACT BY STUDENTID

        const searchResponse = await axios.post(
          `https://api.hubspot.com/crm/v3/objects/contacts/search`,
          {
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: "studentid",
                    operator: "EQ",
                    value: studentId,
                  },
                ],
              },
            ],
            properties: ["hubspot_owner_id", "firstname", "lastname"],
          },
          {
            headers: {
              Authorization: `Bearer ${hubspotApiKey}`,
            },
          }
        );

        //SEARCH CONTACT IN HUBSPOT BY STUDENTID

        //IF CONTACT EXISTS

        let owner = "";
        let contactId = "";
        let contactFirstname = "";
        let contactLastname = "";
        let contactEmail = "";

        if (searchResponse.data.total > 0) {

          console.log("Encontro el contacto en HubSpot por StudentId");

          const contactIdToDeal = searchResponse.data.results[0].id;
          const nameContact =
            searchResponse.data.results[0].properties.firstname;
          const lastnameContact =
            searchResponse.data.results[0].properties.lastname;

          if (searchResponse.data.results[0].properties.hubspot_owner_id) {
            owner = searchResponse.data.results[0].properties.hubspot_owner_id;

            try {
              const searchOwner = await axios.get(
                `https://api.hubspot.com/crm/v3/owners/${owner}`,
                {
                  headers: {
                    Authorization: `Bearer ${hubspotApiKey}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              contactId = searchOwner.data.id;
              contactFirstname = searchOwner.data.firstName;
              contactLastname = searchOwner.data.lastName;
              contactEmail = searchOwner.data.email;

              console.log("Email del propiertario ", contactEmail);
            } catch (error) {
              if (error.response) {
                console.error(
                  "Error de respuesta del servidor:",
                  error.response.data
                );
              } else if (error.request) {
                console.error(
                  "No se recibió respuesta del servidor:",
                  error.request
                );
              } else {
                console.error(
                  "Error al configurar la solicitud:",
                  error.message
                );
              }
              return;
            }
          } else {
            console.log("Contacto sin propietario");
          }

          //STATUS "STEND","DRAFT"

          const graphqlResponse = await axios.post(
            edvisorApiUrl,
            {
              query: `
                      query {
                        studentQuote(studentQuoteId: ${studentQuoteId}) {
                          studentQuoteStatus {
                            codeName
                          }
                        }
                      }
                    `,
            },
            {
              headers: {
                Authorization: `Bearer ${edvisorAuthToken}`,
              },
            }
          );

          let quoteStatus =
            graphqlResponse.data.data.studentQuote.studentQuoteStatus.codeName;
          let quoteStatusFinal = "";

          if (quoteStatus == "SENT") {
            quoteStatusFinal = "APPROVED";
          } else if (quoteStatus == "DRAFT") {
            quoteStatusFinal = "DRAFT";
          } else if (quoteStatus == "EXPIRED") {
            quoteStatusFinal = "REJECTED";
          } else if (quoteStatus == "ACCEPTED") {
            quoteStatusFinal = "APPROVED";
          }

          console.log("Status para asignar a la cotizacion", quoteStatus);

          console.log("respuesta de primer query", graphqlResponse);

          const graphqlResponse4 = await axios.post(
            edvisorApiUrl,
            {
              query: `query {
              studentQuote(studentQuoteId:${studentQuoteId}) {
                studentQuoteId
                # optional: add any student quote field 46684083
                studentQuoteStatus {
                  studentQuoteStatusId
                  codeName
                }
                agency {
                  agencyId
                  # optional: add any agency field
                }
                student {
                  studentId
                  # optional: add any student field
                }
                agentUser {
                  userId
                  # optional: add any user field 
                }
                language {
                  code
                }
                filterStudentCurrentCountry {
                  countryId
                  code
                }
                filterEligibleStudentNationalityCountry {
                  countryId
                  code
                }
                studentQuoteOptions {
                  name
                  isAccepted
                  totalPrice
                  priceCurrencyId
                  notes,
                  studentQuoteOptionItems {
                    __typename
                    ... on StudentQuoteOptionCourseItem {
                      studentQuoteOptionItemId
                      studentQuoteOptionItemTypeId
                      studentQuoteOptionItemType {
                        studentQuoteOptionItemTypeId
                        codeName
                      }
                      isAgencyItem
                      offeringPriceItem {
                        priceAmount
                        priceCurrency{
                          code
                        }
                        offeringId
                        durationAmount
                        durationTypeId
                        durationType{
                          codeName
                        }
                        startDate
                        endDate
                      }
                      courseSnapshot {
                        liveOffering{
                          offeringCourse{
                            name
                          }
                          school{
                            name
                          }
                        }
                        offeringId
                        offeringCourseCategoryId
                        name
                      }
                    }
                    ... on StudentQuoteOptionInsuranceItem {
                      studentQuoteOptionItemId
                      studentQuoteOptionItemTypeId
                      studentQuoteOptionItemType {
                        studentQuoteOptionItemTypeId
                        codeName
                      }
                      isAgencyItem
                      offeringPriceItem {
                        offeringId
                        offering{
                          name
                          school{
                            name
                          }
                        }
                        durationAmount
                        durationTypeId
                        startDate
                        endDate
                        durationType{
                          codeName
                        }
                        priceAmount
                        priceCurrency{
                          code
                        }
                      }
                      insuranceSnapshot {
                        offeringId
                        name
                      }
                    }
                    ... on StudentQuoteOptionAccommodationItem {
                      
                      studentQuoteOptionItemId
                      studentQuoteOptionItemTypeId
                      studentQuoteOptionItemType {
                        studentQuoteOptionItemTypeId
                        codeName
                      }
                      isAgencyItem
                      offeringPriceItem {
                        offeringId
                        offering{
                          name
                          school{
                            name
                          }
                        }
                        durationAmount
                        durationTypeId
                        startDate
                        endDate
                        durationType{
                          codeName
                        }
                        priceAmount
                        priceCurrency{
                          code
                        }
                      }
                      accommodationSnapshot {
                        offeringId
                        offeringAccommodationCategoryId
                        bathroomTypeId
                        roomTypeId
                        mealTypeId
                        name
                      }
                    }
                    ... on StudentQuoteOptionServiceItem {
                      studentQuoteOptionItemId
                      studentQuoteOptionItemType {
                        codeName
                      }
                      isAgencyItem
                      offeringPriceItem {
                        offering{
                          school{
                            name
                          }
                        }
                        offeringId
                        durationAmount
                        durationTypeId
                        durationType{
                          codeName
                        }
                        startDate
                        endDate
                        priceAmount
                        priceCurrency{
                          code
                        }
                        offering{
                          name
                        }
                      }
                      serviceSnapshot {
                        offeringId
                        serviceQuantity
                        name
                      }
                    }
                    
                    ... on StudentQuoteOptionFeeItem {
                      studentQuoteOptionItemId
                      studentQuoteOptionItemType {
                        codeName
                      }
                      isAgencyItem
                      appliedFeePriceItem {
                        priceAmount
                        priceCurrency{
                          code
                        }
                        feeId
                        appliedToOfferingId
                        durationAmount
                        durationTypeId
                        startDate
                        endDate
                      }
                      feeSnapshot {
                        feeId
                        name
                      }
                    }
                    ... on StudentQuoteOptionDiscountItem {
                      studentQuoteOptionItemId
                      studentQuoteOptionItemType {
                        codeName
                      }
                      isAgencyItem
                      promotionSnapshot {
                        promotionId
                        name
                      }
                      appliedDiscountPriceItem {
                        ... on AppliedAmountOffDiscountPriceItem {
                          promotionId
                          promotion {
                            name
                          }
                          priceAmount
                          priceCurrency {
                            currencyId
                            code
                            symbol
                          }
                          appliedToOffering {
                            offeringId
                            # optional: add any field on an offering
                          }
                          endDate
                        }
                        ... on AppliedDurationExtensionDiscountPriceItem {
                          promotionId
                          priceAmount
                          priceCurrency {
                            currencyId
                            code
                            symbol
                          }
                          endDate
                          extensionDurationType {
                            durationTypeId
                            codeName
                          }
                          extensionDurationAmount
                          promotion {
                            name
                          }
                          appliedToOffering {
                            offeringId
                            # optional: add any offering field
                          }
                        }
                        ... on AppliedCustomDiscountPriceItem {
                          promotionId
                          promotion {
                            name
                          }
                          appliedToOffering {
                            offeringId
                            # optional: add any offering field
                          }
                          endDate
                          discountDescription
                        }
                        # ... on moreDiscountPriceItem types will be supported in the future
                      }
                    }
                  }
                  studentQuoteOptionFiles {
                    fileId
                    uploaderUserId
                    mimeType
                    fileExtension
                    name
                    path
                    url
                  },
                  totalPrice,
                    totalInOriginalCurrenies{
                      amount
                      currency{
                        code
                      }
                    }
                    priceCurrency {
                      code
                    }
                }
              }
            }`,
            },
            {
              headers: {
                Authorization: `Bearer ${edvisorAuthToken}`,
              },
            }
          );

          const studentQuoteOptions =
            graphqlResponse4.data.data.studentQuote.studentQuoteOptions;

          const sortedStudentQuoteOptions = [...studentQuoteOptions].sort(
            (a, b) => a.name.localeCompare(b.name)
          );

          console.log(
            "studentQuoteOptions ordenadas por nombre:",
            sortedStudentQuoteOptions
          );

          var maxTotalAmount = Math.max(...sortedStudentQuoteOptions.map(
              (option) => option.totalInOriginalCurrenies[0].amount
            )
          );

          const currencyDeal =
            sortedStudentQuoteOptions[0].totalInOriginalCurrenies[0].currency
              .code;

          console.log("Moneda para el negocio", currencyDeal);

          const lineItemsValue = [];
          const lineItemsValueDiscount = [];
          const promotionsValue = [];
          let totalPrice = 0;
          let totalCurrency = "";
          let totalAnotherPrice = 0;
          let totalAnotherCurrency = "";

          let schoolName;
          let startDate;
          let endDate;
          let durationAmount;
          let durantionDays;
          let campus;
          let quoteOptionId1 = null;
          let quoteOptionId2 = null;
          let quoteOptionId3 = null;
          let quoteOptionId4 = null;
          let quoteOptionId5 = null;
          let quoteOptionId6 = null;
          let promotionId = 0;
          let sortOrderCounter = 1;

          for (let i = 0; i < sortedStudentQuoteOptions.length; i++) {
            const option = sortedStudentQuoteOptions[i];
            let optionLineItems = [];
            let optionLineItemsDiscount = [];
            let optionPromotions = [];

            for (let j = 0; j < option.studentQuoteOptionItems.length; j++) {
              let element = option.studentQuoteOptionItems[j];

              if (element.__typename === "StudentQuoteOptionCourseItem") {

                const courseName = (element.courseSnapshot?.liveOffering?.offeringCourse?.name) ?? 'null';
                const priceAmountCourse = (element.offeringPriceItem?.priceAmount) ?? 'null';
                const currencyCourse = (element.offeringPriceItem?.priceCurrency?.code) ?? 'null';
                const category = (element.studentQuoteOptionItemType?.codeName) ?? 'null';
                const id_ed = element.studentQuoteOptionItemId ?? 'null';
                 schoolName = (element.courseSnapshot?.liveOffering?.school?.name) ?? 'null';
                 startDate = (element.offeringPriceItem?.startDate) ?? 'null';
                 endDate = (element.offeringPriceItem?.endDate) ?? 'null';
                 durationAmount = (element.offeringPriceItem?.durationAmount) ?? 'null';
                 durantionDays = (element.offeringPriceItem?.durationType?.codeName) ?? 'null';
                 campus = (element.courseSnapshot?.liveOffering?.school?.address) ?? 'null';
                /* const courseName = element.courseSnapshot.liveOffering.offeringCourse.name;
                const priceAmountCourse = element.offeringPriceItem.priceAmount;
                const currencyCourse =
                  element.offeringPriceItem.priceCurrency.code;
                const category = element.studentQuoteOptionItemType.codeName;
                const id_ed = element.studentQuoteOptionItemId;
                schoolName =
                  schoolName || element.courseSnapshot.liveOffering.school.name;
                startDate = element.offeringPriceItem.startDate;
                endDate = element.offeringPriceItem.endDate;
                durationAmount = element.offeringPriceItem.durationAmount;
                durantionDays = element.offeringPriceItem.durationType.codeName;

                schoolName = element.courseSnapshot.liveOffering.school.name;
                startDate = element.offeringPriceItem.startDate;
                endDate = element.offeringPriceItem.endDate;
                durationAmount = element.offeringPriceItem.durationAmount;
                durantionDays = element.offeringPriceItem.durationType.codeName;
                campus = element.courseSnapshot.liveOffering.school.address; */

                // Process course item
                const courseProperties = {
                  properties: {
                    price: priceAmountCourse, //element.offeringPriceItem.priceAmount,
                    hs_line_item_currency_code: currencyCourse, //element.offeringPriceItem.priceCurrency.code,
                    name: courseName, //element.courseSnapshot.name,
                    product_category: category, //element.studentQuoteOptionItemType.codeName,
                    institution: schoolName, //element.courseSnapshot.liveOffering.school.name,
                    duration: durationAmount, //element.offeringPriceItem.durationAmount,
                    duration_type: durantionDays, //element.offeringPriceItem.durationType.codeName,
                    start_date: startDate, //element.offeringPriceItem.startDate,
                    end_date: endDate, //element.offeringPriceItem.endDate,
                    name_edvisor: courseName, //element.courseSnapshot.liveOffering.offeringCourse.name,
                    quantity: 1,
                    hs_sku: id_ed, //element.studentQuoteOptionItemId,
                    address: campus,
                  },
                };

                console.log(
                  "Propiedades para pasar",
                  JSON.stringify(courseProperties, null, 2)
                );

                const lineItemId = await createLineItem(courseProperties);

                if (lineItemId !== null) {
                  optionLineItems.push(lineItemId);

                  const response = await axios.patch(
                    `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                      lineItemId
                    )}`,
                    {
                      properties: {
                        hubspot_id: lineItemId,
                      },
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${hubspotApiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  console.log("Line Item actualizado con ID", response.data);
                } else {
                  console.log("el lieItemId es null");
                }
              } 

            }

            for (let j = 0; j < option.studentQuoteOptionItems.length; j++) {
              let element = option.studentQuoteOptionItems[j];
              
              if (element.__typename === "StudentQuoteOptionFeeItem") {
                // Process fee item
                const feeSnapshot = element.feeSnapshot;
                const appliedFeePriceItem = element.appliedFeePriceItem;

                const feeName = feeSnapshot
                  ? feeSnapshot.name
                    ? feeSnapshot.name
                    : "NombreNoDefinido"
                  : "NombreNoDefinido";

                const feeProperties = {
                  properties: {
                    product_category:
                      element.studentQuoteOptionItemType.codeName,
                    price: appliedFeePriceItem
                      ? appliedFeePriceItem.priceAmount
                      : null,
                    hs_line_item_currency_code: appliedFeePriceItem
                      ? appliedFeePriceItem.priceCurrency.code
                      : null,
                    name: feeName,
                    name_edvisor: feeName,
                    quantity: 1,
                    hs_sku: element.studentQuoteOptionItemId,
                  },
                };
                console.log(
                  "Propiedades para pasar",
                  JSON.stringify(feeProperties, null, 2)
                );

                const lineItemId = await createLineItem(feeProperties);

                if (lineItemId !== null) {
                  optionLineItems.push(lineItemId);

                  const response = await axios.patch(
                    `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                      lineItemId
                    )}`,
                    {
                      properties: {
                        hubspot_id: lineItemId,
                      },
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${hubspotApiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  console.log("Line Item actualizado con ID", response.data);
                } else {
                  console.log("el lieItemId es null");
                }
              } else if (
                element.__typename === "StudentQuoteOptionDiscountItem"
              ) {
                if (
                  "priceAmount" in element.appliedDiscountPriceItem &&
                  "priceCurrency" in element.appliedDiscountPriceItem
                ) {
                  const discountProperties = {
                    properties: {
                      product_category:
                        element.studentQuoteOptionItemType.codeName,
                      price: element.appliedDiscountPriceItem
                        ? Math.abs(element.appliedDiscountPriceItem.priceAmount)
                        : null,
                      hs_line_item_currency_code:
                        element.appliedDiscountPriceItem
                          ? element.appliedDiscountPriceItem.priceCurrency.code
                          : null,
                      name: element.promotionSnapshot
                        ? element.promotionSnapshot.name
                          ? element.promotionSnapshot.name
                          : "N/A"
                        : "N/A",
                      name_edvisor: element.promotionSnapshot
                        ? element.promotionSnapshot.name
                          ? element.promotionSnapshot.name
                          : "N/A"
                        : "N/A",
                      quantity: -1,
                      hs_sku: element.studentQuoteOptionItemId,
                      end_date: element.appliedDiscountPriceItem
                        ? element.appliedDiscountPriceItem.endDate
                          ? element.appliedDiscountPriceItem.endDate
                          : ""
                        : "",
                    },
                  };

                  //Creacion de Discount como LineItem 

                  const lineItemId = await createLineItem(discountProperties);

                  if (lineItemId !== null) {
                    optionLineItemsDiscount.push(lineItemId);

                    const response2 = await axios.patch(
                      `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                        lineItemId
                      )}`,
                      {
                        properties: {
                          hubspot_id: lineItemId,
                        },
                      },
                      {
                        headers: {
                          Authorization: `Bearer ${hubspotApiKey}`,
                          "Content-Type": "application/json",
                        },
                      }
                    );

                    console.log("Line Item Discount actualizado con ID", response2.data);
                  } else {
                    console.log("el lieItemId Discount es null");
                  }

                  //Fin 

                  const response = await axios.post(
                    `https://api.hubspot.com/crm/v3/objects/discount`,
                    {
                      properties: {
                        hs_type: "FIXED",
                        hs_label: element.promotionSnapshot.name,
                        hs_value: Math.abs(
                          element.appliedDiscountPriceItem.priceAmount
                        ),
                        hs_duration: "ONCE",
                        hs_sort_order: sortOrderCounter.toString(),
                      },
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${hubspotApiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  console.log("Promocion creada", response.data);

                  promotionId = response.data.id;

                  optionPromotions.push(promotionId);

                  sortOrderCounter++;
                } else {
                  console.log(
                    "Faltan campos obligatorios (Price - Currency )para crear el line item"
                  );
                }
              } else if (
                element.__typename === "StudentQuoteOptionServiceItem"
              ) {
                const offeringPriceItem = element.offeringPriceItem;
                const offering = offeringPriceItem?.offering;

                const serviceProperties = {
                  properties: {
                    price: offeringPriceItem?.priceAmount ?? null,
                    hs_line_item_currency_code:
                      offeringPriceItem?.priceCurrency?.code ?? null,
                    name: offering?.name ?? "N/A",
                    product_category:
                      element.studentQuoteOptionItemType.codeName,
                    institution: offering?.school?.name ?? "N/A",
                    duration: offeringPriceItem?.durationAmount ?? null,
                    duration_type:
                      offeringPriceItem?.durationType?.codeName ?? null,
                    start_date: offeringPriceItem?.startDate ?? null,
                    end_date: offeringPriceItem?.endDate ?? null,
                    name_edvisor: offering?.name ?? "N/A",
                    quantity: 1,
                    hs_sku: element.studentQuoteOptionItemId,
                  },
                };

                console.log(
                  "Propiedades para pasar",
                  JSON.stringify(serviceProperties, null, 2)
                );

                const lineItemId = await createLineItem(serviceProperties);

                if (lineItemId !== null) {
                  optionLineItems.push(lineItemId);

                  const response = await axios.patch(
                    `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                      lineItemId
                    )}`,
                    {
                      properties: {
                        hubspot_id: lineItemId,
                      },
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${hubspotApiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  console.log("Line Item actualizado con ID", response.data);
                } else {
                  console.log("el lieItemId es null");
                }
              } else if (
                element.__typename === "StudentQuoteOptionAccommodationItem"
              ) {
                // Process accommodation item
                const offeringPriceItem = element.offeringPriceItem;
                const offering = offeringPriceItem
                  ? offeringPriceItem.offering
                  : null;

                const accommodationProperties = {
                  properties: {
                    price: offeringPriceItem
                      ? offeringPriceItem.priceAmount
                      : null,
                    hs_line_item_currency_code: offeringPriceItem
                      ? offeringPriceItem.priceCurrency.code
                      : null,
                    name: offering ? offering.name : "N/A",
                    product_category:
                      element.studentQuoteOptionItemType.codeName,
                    institution: offering ? offering.school.name : "N/A",
                    duration: offeringPriceItem
                      ? offeringPriceItem.durationAmount
                      : null,
                    duration_type: offeringPriceItem
                      ? offeringPriceItem.durationType.codeName
                      : null,
                    start_date: offeringPriceItem
                      ? offeringPriceItem.startDate
                      : null,
                    end_date: offeringPriceItem
                      ? offeringPriceItem.endDate
                      : null,
                    name_edvisor: offering ? offering.name : "N/A",
                    quantity: 1,
                    hs_sku: element.studentQuoteOptionItemId,
                  },
                };

                console.log(
                  "Propiedades para pasar",
                  JSON.stringify(accommodationProperties, null, 2)
                );

                const lineItemId = await createLineItem(
                  accommodationProperties
                );

                if (lineItemId !== null) {
                  optionLineItems.push(lineItemId);

                  const response = await axios.patch(
                    `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                      lineItemId
                    )}`,
                    {
                      properties: {
                        hubspot_id: lineItemId,
                      },
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${hubspotApiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  console.log("Line Item actualizado con ID", response.data);
                } else {
                  console.log("el lieItemId es null");
                }
              } else if (
                element.__typename === "StudentQuoteOptionInsuranceItem"
              ) {
                // Process accommodation item
                const offeringPriceItem = element.offeringPriceItem;
                const offering = offeringPriceItem
                  ? offeringPriceItem.offering
                  : null;

                const insuranceProperties = {
                  properties: {
                    price: offeringPriceItem
                      ? offeringPriceItem.priceAmount
                      : null,
                    hs_line_item_currency_code: offeringPriceItem
                      ? offeringPriceItem.priceCurrency.code
                      : null,
                    name: offering ? offering.name : "N/A",
                    product_category:
                      element.studentQuoteOptionItemType.codeName,
                    institution: offering ? offering.school.name : "N/A",
                    duration: offeringPriceItem
                      ? offeringPriceItem.durationAmount
                      : null,
                    duration_type: offeringPriceItem
                      ? offeringPriceItem.durationType.codeName
                      : null,
                    start_date: offeringPriceItem
                      ? offeringPriceItem.startDate
                      : null,
                    end_date: offeringPriceItem
                      ? offeringPriceItem.endDate
                      : null,
                    name_edvisor: offering ? offering.name : "N/A",
                    quantity: 1,
                    hs_sku: element.studentQuoteOptionItemId,
                  },
                };

                console.log(
                  "Propiedades para pasar",
                  JSON.stringify(insuranceProperties, null, 2)
                );

                const lineItemId = await createLineItem(insuranceProperties);

                if (lineItemId !== null) {
                  optionLineItems.push(lineItemId);

                  const response = await axios.patch(
                    `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                      lineItemId
                    )}`,
                    {
                      properties: {
                        hubspot_id: lineItemId,
                      },
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${hubspotApiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  console.log("Line Item actualizado con ID", response.data);
                } else {
                  console.log("el lieItemId es null");
                }
              }
            }

            lineItemsValue.push(optionLineItems);

            promotionsValue.push(optionPromotions);

            lineItemsValueDiscount.push(optionLineItemsDiscount)

            console.log(
              "Los line items para la opción",
              option.name,
              "son",
              optionLineItems
            );

            console.log("Las promociones obtenidas fueron", optionPromotions);

            console.log("Los line Items discounts fueron",optionLineItemsDiscount);
          }

          async function createLineItem(lineItemData) {
            try {
              console.log(
                "Propiedades que llegaron para crear el line item",
                lineItemData
              );

              let currency = lineItemData.properties.hs_line_item_currency_code;
              let price = lineItemData.properties.price;

              if (currency !== currencyDeal) {
                console.log(
                  "Moneda del LineItem y Negocio distintas",
                  currency,
                  "",
                  currencyDeal
                );

                const graphqlResponse = await axios.post(
                  edvisorApiUrl,
                  {
                    query: `
                            query {
                              agencyCompanyCurrencyRates {
                                fromCurrency { code }
                                toCurrency { code }
                                rate
                              }
                            }
                          `,
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${edvisorAuthToken}`,
                    },
                  }
                );

                const currencyRates =
                  graphqlResponse.data.data.agencyCompanyCurrencyRates;
                let rateObj;

                for (let i = 0; i < currencyRates.length; i++) {
                  const rate = currencyRates[i];
                  if (
                    rate.fromCurrency.code === currency &&
                    rate.toCurrency.code === currencyDeal
                  ) {
                    rateObj = rate;
                    break; // Se encontró la tasa de cambio, salimos del bucle.
                  }
                }

                const conversionRate = rateObj ? rateObj.rate : 1;
                price *= conversionRate;

                const updatedLineItemData = {
                  properties: {
                    ...lineItemData.properties,
                    price: price,
                    hs_line_item_currency_code: currencyDeal,
                  },
                };

                const response = await axios.post(
                  "https://api.hubspot.com/crm/v3/objects/line_item",
                  updatedLineItemData,
                  {
                    headers: {
                      Authorization: `Bearer ${hubspotApiKey}`,
                      "Content-Type": "application/json",
                    },
                  }
                );

                console.log("Line item creado", response.data);

                return response.data.id;
              } else {
                console.log("Moneda del lineItem y Negocio iguales");

                const response = await axios.post(
                  "https://api.hubspot.com/crm/v3/objects/line_item",
                  lineItemData,
                  {
                    headers: {
                      Authorization: `Bearer ${hubspotApiKey}`,
                      "Content-Type": "application/json",
                    },
                  }
                );

                console.log("Line item creado", response.data);

                return response.data.id;
              }
            } catch (error) {
              console.error("Error al crear el line item:", error);
              return null;
            }
          }

          // Process total information
          sortedStudentQuoteOptions.forEach((option, index) => {
            const optionName = option.name;
            const newTotalPrice = option.totalPrice;
            const newTotalCurrencyCode = option.priceCurrency.code;
            const newTotalAnotherPrice =
              option.totalInOriginalCurrenies[0].amount;
            const newTotalAnotherCurrencyCode =
              option.totalInOriginalCurrenies[0].currency.code;

            if (index === 1) {
              quoteOptionId1 = optionName;
              totalPrice += newTotalPrice;
              totalCurrency = newTotalCurrencyCode;
              totalAnotherPrice += newTotalAnotherPrice;
              totalAnotherCurrency = newTotalAnotherCurrencyCode;
            } else if (index === 2) {
              quoteOptionId2 = optionName;
              totalPrice += newTotalPrice;
              totalCurrency = newTotalCurrencyCode;
              totalAnotherPrice += newTotalAnotherPrice;
              totalAnotherCurrency = newTotalAnotherCurrencyCode;
            } else if (index === 3) {
              quoteOptionId3 = optionName;
              totalPrice += newTotalPrice;
              totalCurrency = newTotalCurrencyCode;
              totalAnotherPrice += newTotalAnotherPrice;
              totalAnotherCurrency = newTotalAnotherCurrencyCode;
            } else if (index === 4) {
              quoteOptionId4 = optionName;
              totalPrice += newTotalPrice;
              totalCurrency = newTotalCurrencyCode;
              totalAnotherPrice += newTotalAnotherPrice;
              totalAnotherCurrency = newTotalAnotherCurrencyCode;
            } else if (index === 5) {
              quoteOptionId5 = optionName;
              totalPrice += newTotalPrice;
              totalCurrency = newTotalCurrencyCode;
              totalAnotherPrice += newTotalAnotherPrice;
              totalAnotherCurrency = newTotalAnotherCurrencyCode;
            } else if (index === 6) {
              quoteOptionId6 = optionName;
              totalPrice += newTotalPrice;
              totalCurrency = newTotalCurrencyCode;
              totalAnotherPrice += newTotalAnotherPrice;
              totalAnotherCurrency = newTotalAnotherCurrencyCode;
            }
          });

          console.log("Los line items totales son", lineItemsValue);

          console.log("Las promociones totales son", promotionsValue);

          console.log("Los line items Discounts totales son", lineItemsValueDiscount);

          //FIND OWNER EDVISOR TO HUBSPOT
          let ownerEdvisor = null;

          try {

            console.log("** UPDATE OWNERS - Creacion **");

            console.log("Tokens a enviar - hubspotToken", hubspotApiKey);
            console.log("Tokens a enviar - edvisorToken", edvisorAuthToken);

            const client = new LambdaClient();
            const input = {
              FunctionName: process.env.FUNCTION_NAME,
              InvocationType: "RequestResponse",
              Payload: JSON.stringify({
                HUBSPOT_TOKEN: hubspotApiKey,
                EDVISOR_TOKEN: edvisorAuthToken,
              }),
            };
            const command = new InvokeCommand(input);
            const response = await client.send(command);

            agencyIdToSearch = agencyId ? agencyId : parseInt(id_agencia);

            console.log("id de agencia para buscar", agencyIdToSearch);

            console.log("ownerId para pasar", agentId);

            if (agentId !== null || (agentId !== "" && agentId !== undefined)) {
              const ownerToSearch = agentId;

              console.log("owner antes de la funcion", ownerEdvisor);

              await getEdvisorOwner(
                `${agencyIdToSearch}`,
                `${ownerToSearch}`,
                `${portalIdtoSearch}`
              )
                .then((getOwnerId) => {
                  if (
                    getOwnerId !== null &&
                    getOwnerId !== "" &&
                    getOwnerId !== undefined
                  ) {
                    try {
                      console.log(
                        "Se encontró un agente con el ownerId proporcionado async:",
                        getOwnerId
                      );
                      ownerEdvisor = getOwnerId;
                      console.log(
                        "owner asignado justo en la funcion",
                        ownerEdvisor
                      );
                    } catch (error) {
                      console.log("Error al asignar el owner - motivo:", error);
                    }
                  } else {
                    console.log(
                      "No se encontró un agente con el ownerId proporcionado."
                    );
                  }
                })
                .catch((error) => {
                  console.log("No se encontró propietario para asignar", error);
                });
            } else {
              console.log("OwnerID vacío en el payload");
            }
          } catch (error) {
            console.log("No se encontro propietario para asignar", error);
          }

          console.log(
            `Valores que se van a cargar en el negocio, totalPrice ${totalPrice}, totalCurrency ${totalCurrency}, totalAnotherPrice ${totalAnotherPrice}, totalAnotherCurrency ${totalAnotherCurrency}`
          );

          console.log("Moneda del negocio", currencyDeal);

          let currency2 = totalCurrency !== "CAD" ? `${totalCurrency}` : "";
          let price2 = totalCurrency !== "CAD" ? `${totalPrice}` : "";

          const dealData = {
            properties: {
              dealname: `${schoolName} - ${nameContact} ${lastnameContact}`,
              pipeline: PIPELINE,
              dealstage: DEALSTAGE,
              deal_currency_code: currencyDeal,
              amount: maxTotalAmount,
              price: price2,
              currency_2: currency2,
              studentquoteid: studentQuoteId,
              studentid: studentId,
              statusdealedvisor: true,
              hubspot_owner_id: `${ownerEdvisor ? ownerEdvisor : ""}`,
              quote_option_id_1: quoteOptionId1,
              quote_option_id_2: quoteOptionId2,
              quote_option_id_3: quoteOptionId3,
              quote_option_id_4: quoteOptionId4,
              quote_option_id_5: quoteOptionId5,
              quote_option_id_6: quoteOptionId6,
            },
            associations: [
              {
                to: {
                  id: contactIdToDeal,
                },
                types: [
                  {
                    associationCategory: "HUBSPOT_DEFINED",
                    associationTypeId: 3,
                  },
                ],
              },
            ],
          };

          //asociar line Items al negocio

          for (let i = 0; i < lineItemsValue.length; i++) {
            const lineItem = lineItemsValue[i];

            // Asociar los IDs de los line items
            for (const lineItemId of lineItem) {
              const association = {
                to: {
                  id: lineItemId,
                },
                types: [
                  {
                    associationCategory: "HUBSPOT_DEFINED",
                    associationTypeId: 19,
                  },
                ],
              };
              dealData.associations.push(association);
            }
          }

          //asociar line Items Discount al negocio

          for (let i = 0; i < lineItemsValueDiscount.length; i++) {
            const lineItem = lineItemsValueDiscount[i];

            // Asociar los IDs de los line items
            for (const lineItemId of lineItem) {
              const association = {
                to: {
                  id: lineItemId,
                },
                types: [
                  {
                    associationCategory: "HUBSPOT_DEFINED",
                    associationTypeId: 19,
                  },
                ],
              };
              dealData.associations.push(association);
            }
          }

          try {
            const dealCreate = await axios.post(
              "https://api.hubspot.com/crm/v3/objects/deal",
              dealData,
              {
                headers: {
                  Authorization: `Bearer ${hubspotApiKey}`,
                  "Content-Type": "application/json",
                },
              }
            );

            console.log(
              "Negocio creado con lineItems asociados",
              dealCreate.data
            );

            const newDealId = dealCreate.data.id;

            let num = 1;

            for (const lineItems of lineItemsValue) {
              console.log(`Procesando Option ${num}`);

              console.log("Line Items:", lineItems);

              console.log("Status de la cotizacion a crear", quoteStatusFinal);

              const quoteData = {
                properties: {
                  hs_title: `${titleQuote} - Option ${num}`,
                  hs_status: quoteStatusFinal || "DRAFT",
                  hs_expiration_date:
                    eventData.after.expires ||
                    new Date(
                      Date.now() + 30 * 24 * 60 * 60 * 1000
                    ).toISOString(),
                  hs_currency: totalAnotherCurrency,
                  studentquoteid: eventData.after.studentQuoteId,
                  hs_template_type: "CUSTOMIZABLE_QUOTE_TEMPLATE",
                  hs_language: "en",
                  hs_comments: `Value of line-items expressed in Canadian dollars (CAD)`,
                  hubspot_owner_id: `${ownerEdvisor ? ownerEdvisor : ""}`,
                  hs_sender_firstname: contactFirstname,
                  hs_sender_lastname: contactLastname,
                  hs_sender_email: contactEmail,
                },
                associations: [
                  {
                    to: {
                      id: TEMPLATE_ID, //245775600407 Plantilla de cotizacion Modern Basic
                    },
                    types: [
                      {
                        associationCategory: "HUBSPOT_DEFINED",
                        associationTypeId: 286,
                      },
                    ],
                  },
                  /* {
                      to: {
                        id: contactIdToDeal
                      },
                      types: [
                        {
                          associationCategory: "HUBSPOT_DEFINED",
                          associationTypeId: 69,
                        },
                      ],
                    }, */
                  {
                    to: {
                      id: dealCreate.data.id,
                    },
                    types: [
                      {
                        associationCategory: "HUBSPOT_DEFINED",
                        associationTypeId: 64,
                      },
                    ],
                  },
                ],
              };

              // Agregar asociación de line items a la cotización
              for (const lineItemId of lineItems) {
                const association = {
                  to: {
                    id: lineItemId,
                  },
                  types: [
                    {
                      associationCategory: "HUBSPOT_DEFINED",
                      associationTypeId: 67,
                    },
                  ],
                };

                quoteData.associations.push(association);
              }

              const quoteResponse = await axios.post(
                "https://api.hubspot.com/crm/v3/objects/quotes",
                quoteData,
                {
                  headers: {
                    Authorization: `Bearer ${hubspotApiKey}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              console.log("A punto de crear la cotizacion");

              console.log(
                "Nueva Cotización creada en HubSpot:",
                quoteResponse.data
              );

              const quoteId = quoteResponse.data.id;

              try {
                console.log("...Buscando Discount para asociar");

                // Verificamos si hay descuentos para esta cotización
                if (
                  promotionsValue[num - 1] &&
                  promotionsValue[num - 1].length > 0
                ) {
                  const promotions = promotionsValue[num - 1]; // Utilizamos num - 1 para obtener el índice correcto

                  // Iteramos sobre los descuentos asociados a la cotización actual
                  for (const promotionId of promotions) {
                    const updateQuote = await axios.put(
                      `https://api.hubspot.com/crm/v4/objects/quotes/${quoteId}/associations/default/discounts/${promotionId}`,
                      {},
                      {
                        headers: {
                          Authorization: `Bearer ${hubspotApiKey}`,
                          "Content-Type": "application/json",
                        },
                      }
                    );

                    console.log(
                      "Cotizacion actualizada",
                      quoteId,
                      "con el siguiente Descuento",
                      promotionId
                    );
                  }
                }
              } catch (error) {
                console.error("Error", error);
              }

              await axios.patch(
                `https://api.hubspot.com/crm/v3/objects/deal/${newDealId}`,
                {
                  properties: {
                    [`quote_option_id_${num}`]: `Option ${num} ; ${quoteId}`,
                  },
                  associations: {
                    to: {
                      id: quoteId,
                    },
                    types: [
                      {
                        associationCategory: "HUBSPOT_DEFINED",
                        associationTypeId: 63,
                      },
                    ],
                  },
                },
                {
                  headers: {
                    Authorization: `Bearer ${hubspotApiKey}`,
                    "Content-Type": "application/json",
                  },
                }
              );
              num++;
            }

            console.log("Actualizando contacto");

            try {
              const updateContactPortalId = await axios.patch(
                `https://api.hubspot.com/crm/v3/objects/contacts/${contactIdToDeal}`,
                {
                  properties: {
                    hsportalid: portalIdtoSearch,
                  },
                },
                {
                  headers: {
                    Authorization: `Bearer ${hubspotApiKey}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              console.log(
                `Contacto actualizado ${studentId} con el siguiente portalId ${portalIdtoSearch}`
              );
            } catch (error) {
              console.error("Error al actualizar portalId en contacto", error);
            }
          } catch (error) {
            console.error("Error al crear negocio y cotización", error);
            console.log(error.data.errors);
            console.log(error.data.errors[0]);
          }
        } else {
          //IF NOT EXISTS

          console.log(
            "No se encontro el contacto en HubSpot por StudentId, se creará y asociara al negocio"
          );

          try {
            const graphqlResponse = await axios.post(
              edvisorApiUrl,
              {
                query: `query{
                    student(studentId:${studentId}){
                      agencyId
                      birthdate
                      metadata
                      firstname
                      lastname
                      email
                      nationalityId
                      modified
                      created
                      owner{
                        firstname
                        lastname
                        email
                      }
                      ownerId
                      phone
                      customPropertyValues{
                          customPropertyFieldId
                          value
                        }
                    }
                  }`,
              },
              {
                headers: {
                  Authorization: `Bearer ${edvisorAuthToken}`,
                },
              }
            );

            var getOwner = "";

            var ownerId = graphqlResponse.data.data.student.ownerId;

            agencyId = graphqlResponse.data.data.student.agencyId;

            let mobileValue = null;

            for (const customPropertyValue of graphqlResponse.data.data.student
              .customPropertyValues) {
              if (customPropertyValue.customPropertyFieldId === "mobile") {
                mobileValue = customPropertyValue.value;
                break;
              }
            }

            const firstnameStudent =
              graphqlResponse.data.data.student.firstname;
            const lastnameStudent = graphqlResponse.data.data.student.lastname;
            const emailStudent = graphqlResponse.data.data.student.email;
            const phoneStudent = graphqlResponse.data.data.student.phone;
            const countryhsStudent =
              graphqlResponse.data.data.student.nationalityId;
            const fechaNacStudent = graphqlResponse.data.data.student.birthdate;

            console.log(
              "firstname",
              firstnameStudent,
              "countryhs",
              countryhsStudent
            );

            const contactData = {
              properties: {
                email: emailStudent,
                firstname: firstnameStudent,
                lastname: lastnameStudent,
                is_deleted: "false",
                studentid: studentId,
                phone: phoneStudent,
                countryhs: countryhsStudent,
                fecha_nacimiento: fechaNacStudent,
                id_agency: agencyId,
                mobilephone: mobileValue !== null ? mobileValue : "",
                hsportalid: portalIdtoSearch,
              },
            };

            try {
              console.log("** UPDATE OWNERS - Creacion si no existe **");

              console.log("Tokens a enviar - hubspotToken", hubspotApiKey);
              console.log("Tokens a enviar - edvisorToken", edvisorAuthToken);

              const client = new LambdaClient();
              const input = {
                FunctionName: process.env.FUNCTION_NAME,
                InvocationType: "RequestResponse",
                Payload: JSON.stringify({
                  HUBSPOT_TOKEN: hubspotApiKey,
                  EDVISOR_TOKEN: edvisorAuthToken,
                }),
              };
              const command = new InvokeCommand(input);
              const response = await client.send(command);

              console.log("id de agencia para buscar", agencyId);

              agencyIdToSearch = agencyId;

              const ownerIdToSearch = ownerId ? ownerId : "";

              console.log("ownerid para pasar", ownerId);

              if (ownerId !== null) {
                getOwner = await getEdvisorOwner(
                  `${agencyIdToSearch}`,
                  `${ownerIdToSearch}`,
                  `${portalIdtoSearch}`
                );

                console.log("Valor de getOwner", getOwner);

                if (getOwner !== null) {
                  try {
                    contactData.properties.hubspot_owner_id = getOwner;
                    console.log(
                      "Se encontró un agente con el ownerId proporcionado:",
                      getOwner
                    );
                  } catch (error) {
                    console.log("Error al asignar el owner - motivo:", error);
                  }
                } else {
                  console.log(
                    "No se encontró un agente con el ownerId proporcionado."
                  );
                }
              } else {
                console.log(
                  "eventData.after.ownerId está vacío, no se asignará ningún owner"
                );
              }
            } catch (error) {
              console.log("No se encontro propietario para asginar", error);
            }

            try {

              let response;

              try {
                
                response = await axios.post(
                  "https://api.hubspot.com/crm/v3/objects/contacts",
                  contactData,
                  {
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${hubspotApiKey}`,
                    },
                  }
                );

                console.log("Contacto creado exitosamente:", response.data);

              } catch(error){

                //Ultimo Update 19/01/2024

                  console.error('No se pudo crear el contacto, probablemente exista, intentando nuevamente',error);

                  const string = error.response.data.message

                  const match = string.match(/Existing ID: (\d+)/);

                  if (match) {

                    const existingId = match[1];

                    const updateContact = await axios.patch(
                      `https://api.hubspot.com/crm/v3/objects/contacts/${existingId}`,
                      {
                        properties:{
                          studentid:studentId
                        }
                      },
                      {
                        headers: {
                          Authorization: `Bearer ${hubspotApiKey}`,
                        },
                      }
                    );

                    console.log(`Contacto actualizado ${existingId} con el siguiente studentId ${studentId}`)
                    
                  } else {
                    console.log('No se encontró un ID existente en la cadena.');
                  }

                //Ultimo Update 19/01/2024
                }

              const contactId = response.data.id;
              const contactFirstname = response.data.properties.firstname;
              const contactLastname = response.data.properties.lastname;
              const contactEmail = response.data.properties.email;

              //STATUS "STEND","DRAFT"

              const graphqlResponse = await axios.post(
                edvisorApiUrl,
                {
                  query: `
                            query {
                              studentQuote(studentQuoteId: ${studentQuoteId}) {
                                studentQuoteStatus {
                                  codeName
                                }
                              }
                            }
                          `,
                },
                {
                  headers: {
                    Authorization: `Bearer ${edvisorAuthToken}`,
                  },
                }
              );

              let quoteStatus =
                graphqlResponse.data.data.studentQuote.studentQuoteStatus
                  .codeName;
              let quoteStatusFinal = "";

              if (quoteStatus == "SENT") {
                quoteStatusFinal = "APPROVED";
              } else if (quoteStatus == "DRAFT") {
                quoteStatusFinal = "DRAFT";
              } else if (quoteStatus == "EXPIRED") {
                quoteStatusFinal = "REJECTED";
              } else if (quoteStatus == "ACCEPTED") {
                quoteStatusFinal = "APPROVED";
              }

              console.log("respuesta de primer query", graphqlResponse);

              const graphqlResponse4 = await axios.post(
                edvisorApiUrl,
                {
                  query: `query {
                      studentQuote(studentQuoteId:${studentQuoteId}) {
                        studentQuoteId
                        # optional: add any student quote field 46684083
                        studentQuoteStatus {
                          studentQuoteStatusId
                          codeName
                        }
                        agency {
                          agencyId
                          # optional: add any agency field
                        }
                        student {
                          studentId
                          # optional: add any student field
                        }
                        agentUser {
                          userId
                          # optional: add any user field 
                        }
                        language {
                          code
                        }
                        filterStudentCurrentCountry {
                          countryId
                          code
                        }
                        filterEligibleStudentNationalityCountry {
                          countryId
                          code
                        }
                        studentQuoteOptions {
                          name
                          isAccepted
                          totalPrice
                          priceCurrencyId
                          notes,
                          studentQuoteOptionItems {
                            __typename
                            ... on StudentQuoteOptionCourseItem {
                              studentQuoteOptionItemId
                              studentQuoteOptionItemTypeId
                              studentQuoteOptionItemType {
                                studentQuoteOptionItemTypeId
                                codeName
                              }
                              isAgencyItem
                              offeringPriceItem {
                                priceAmount
                                priceCurrency{
                                  code
                                }
                                offeringId
                                durationAmount
                                durationTypeId
                                durationType{
                                  codeName
                                }
                                startDate
                                endDate
                              }
                              courseSnapshot {
                                liveOffering{
                                  offeringCourse{
                                    name
                                  }
                                  school{
                                    name
                                  }
                                }
                                offeringId
                                offeringCourseCategoryId
                                name
                              }
                            }
                            ... on StudentQuoteOptionInsuranceItem {
                              studentQuoteOptionItemId
                              studentQuoteOptionItemTypeId
                              studentQuoteOptionItemType {
                                studentQuoteOptionItemTypeId
                                codeName
                              }
                              isAgencyItem
                              offeringPriceItem {
                                offeringId
                                offering{
                                  name
                                  school{
                                    name
                                  }
                                }
                                durationAmount
                                durationTypeId
                                startDate
                                endDate
                                durationType{
                                  codeName
                                }
                                priceAmount
                                priceCurrency{
                                  code
                                }
                              }
                              insuranceSnapshot {
                                offeringId
                                name
                              }
                            }
                            ... on StudentQuoteOptionAccommodationItem {
                              
                              studentQuoteOptionItemId
                              studentQuoteOptionItemTypeId
                              studentQuoteOptionItemType {
                                studentQuoteOptionItemTypeId
                                codeName
                              }
                              isAgencyItem
                              offeringPriceItem {
                                offeringId
                                offering{
                                  name
                                  school{
                                    name
                                  }
                                }
                                durationAmount
                                durationTypeId
                                startDate
                                endDate
                                durationType{
                                  codeName
                                }
                                priceAmount
                                priceCurrency{
                                  code
                                }
                              }
                              accommodationSnapshot {
                                offeringId
                                offeringAccommodationCategoryId
                                bathroomTypeId
                                roomTypeId
                                mealTypeId
                                name
                              }
                            }
                            ... on StudentQuoteOptionServiceItem {
                              studentQuoteOptionItemId
                              studentQuoteOptionItemType {
                                codeName
                              }
                              isAgencyItem
                              offeringPriceItem {
                                offering{
                                  school{
                                    name
                                  }
                                }
                                offeringId
                                durationAmount
                                durationTypeId
                                durationType{
                                  codeName
                                }
                                startDate
                                endDate
                                priceAmount
                                priceCurrency{
                                  code
                                }
                                offering{
                                  name
                                }
                              }
                              serviceSnapshot {
                                offeringId
                                serviceQuantity
                                name
                              }
                            }
                            
                            ... on StudentQuoteOptionFeeItem {
                              studentQuoteOptionItemId
                              studentQuoteOptionItemType {
                                codeName
                              }
                              isAgencyItem
                              appliedFeePriceItem {
                                priceAmount
                                priceCurrency{
                                  code
                                }
                                feeId
                                appliedToOfferingId
                                durationAmount
                                durationTypeId
                                startDate
                                endDate
                              }
                              feeSnapshot {
                                feeId
                                name
                              }
                            }
                            ... on StudentQuoteOptionDiscountItem {
                              studentQuoteOptionItemId
                              studentQuoteOptionItemType {
                                codeName
                              }
                              isAgencyItem
                              promotionSnapshot {
                                promotionId
                                name
                              }
                              appliedDiscountPriceItem {
                                ... on AppliedAmountOffDiscountPriceItem {
                                  promotionId
                                  promotion {
                                    name
                                  }
                                  priceAmount
                                  priceCurrency {
                                    currencyId
                                    code
                                    symbol
                                  }
                                  appliedToOffering {
                                    offeringId
                                    # optional: add any field on an offering
                                  }
                                  endDate
                                }
                                ... on AppliedDurationExtensionDiscountPriceItem {
                                  promotionId
                                  priceAmount
                                  priceCurrency {
                                    currencyId
                                    code
                                    symbol
                                  }
                                  endDate
                                  extensionDurationType {
                                    durationTypeId
                                    codeName
                                  }
                                  extensionDurationAmount
                                  promotion {
                                    name
                                  }
                                  appliedToOffering {
                                    offeringId
                                    # optional: add any offering field
                                  }
                                }
                                ... on AppliedCustomDiscountPriceItem {
                                  promotionId
                                  promotion {
                                    name
                                  }
                                  appliedToOffering {
                                    offeringId
                                    # optional: add any offering field
                                  }
                                  endDate
                                  discountDescription
                                }
                                # ... on moreDiscountPriceItem types will be supported in the future
                              }
                            }
                          }
                          studentQuoteOptionFiles {
                            fileId
                            uploaderUserId
                            mimeType
                            fileExtension
                            name
                            path
                            url
                          },
                          totalPrice,
                            totalInOriginalCurrenies{
                              amount
                              currency{
                                code
                              }
                            }
                            priceCurrency {
                              code
                            }
                        }
                      }
                    }`,
                },
                {
                  headers: {
                    Authorization: `Bearer ${edvisorAuthToken}`,
                  },
                }
              );

              // Assuming you have the GraphQL response stored in a variable named graphqlResponse

              const studentQuoteOptions =
                graphqlResponse4.data.data.studentQuote.studentQuoteOptions;

              const sortedStudentQuoteOptions = [...studentQuoteOptions].sort(
                (a, b) => a.name.localeCompare(b.name)
              );

              console.log(
                "studentQuoteOptions ordenadas por nombre:",
                sortedStudentQuoteOptions
              );

              const maxTotalAmount = Math.max(
                ...sortedStudentQuoteOptions.map(
                  (option) => option.totalInOriginalCurrenies[0].amount
                )
              );

              const currencyDeal =
                sortedStudentQuoteOptions[0].totalInOriginalCurrenies[0]
                  .currency.code;

              console.log("Moneda para el negocio", currencyDeal);

              const lineItemsValue = [];
              const promotionsValue = [];
              const lineItemsValueDiscount = [];
              let totalPrice = 0;
              let totalCurrency = "";
              let totalAnotherPrice = 0;
              let totalAnotherCurrency = "";

              let schoolName;
              let startDate;
              let endDate;
              let durationAmount;
              let durantionDays;
              let campus;
              let quoteOptionId1 = null;
              let quoteOptionId2 = null;
              let quoteOptionId3 = null;
              let quoteOptionId4 = null;
              let quoteOptionId5 = null;
              let quoteOptionId6 = null;
              let promotionId = 0;
              let sortOrderCounter = 1;

              for (let i = 0; i < sortedStudentQuoteOptions.length; i++) {
                const option = sortedStudentQuoteOptions[i];
                let optionLineItems = [];
                let optionPromotions = [];
                let optionLineItemsDiscount = [];

                for (
                  let j = 0;
                  j < option.studentQuoteOptionItems.length;
                  j++
                ) {
                  let element = option.studentQuoteOptionItems[j];

                  if (element.__typename === "StudentQuoteOptionCourseItem") {

                    const courseName = (element.courseSnapshot?.liveOffering?.offeringCourse?.name) ?? 'null';
                    const priceAmountCourse = (element.offeringPriceItem?.priceAmount) ?? 'null';
                    const currencyCourse = (element.offeringPriceItem?.priceCurrency?.code) ?? 'null';
                    const category = (element.studentQuoteOptionItemType?.codeName) ?? 'null';
                    const id_ed = element.studentQuoteOptionItemId ?? 'null';
                    schoolName = (element.courseSnapshot?.liveOffering?.school?.name) ?? 'null';
                    startDate = (element.offeringPriceItem?.startDate) ?? 'null';
                    endDate = (element.offeringPriceItem?.endDate) ?? 'null';
                    durationAmount = (element.offeringPriceItem?.durationAmount) ?? 'null';
                    durantionDays = (element.offeringPriceItem?.durationType?.codeName) ?? 'null';
                    campus = (element.courseSnapshot?.liveOffering?.school?.address) ?? 'null';
                    /* const courseName =
                      element.courseSnapshot.liveOffering.offeringCourse.name;
                    const priceAmountCourse =
                      element.offeringPriceItem.priceAmount;
                    const currencyCourse =
                      element.offeringPriceItem.priceCurrency.code;
                    const category =
                      element.studentQuoteOptionItemType.codeName;
                    const id_ed = element.studentQuoteOptionItemId;
                    schoolName =
                      schoolName ||
                      element.courseSnapshot.liveOffering.school.name;
                    startDate = element.offeringPriceItem.startDate;
                    endDate = element.offeringPriceItem.endDate;
                    durationAmount = element.offeringPriceItem.durationAmount;
                    durantionDays =
                      element.offeringPriceItem.durationType.codeName;

                    schoolName =
                      element.courseSnapshot.liveOffering.school.name;
                    startDate = element.offeringPriceItem.startDate;
                    endDate = element.offeringPriceItem.endDate;
                    durationAmount = element.offeringPriceItem.durationAmount;
                    durantionDays =
                      element.offeringPriceItem.durationType.codeName;
                    campus = element.courseSnapshot.liveOffering.school.address; */

                    // Process course item
                    const courseProperties = {
                      properties: {
                        price: priceAmountCourse, //element.offeringPriceItem.priceAmount,
                        hs_line_item_currency_code: currencyCourse, //element.offeringPriceItem.priceCurrency.code,
                        name: courseName, //element.courseSnapshot.name,
                        product_category: category, //element.studentQuoteOptionItemType.codeName,
                        institution: schoolName, //element.courseSnapshot.liveOffering.school.name,
                        duration: durationAmount, //element.offeringPriceItem.durationAmount,
                        duration_type: durantionDays, //element.offeringPriceItem.durationType.codeName,
                        start_date: startDate, //element.offeringPriceItem.startDate,
                        end_date: endDate, //element.offeringPriceItem.endDate,
                        name_edvisor: courseName, //element.courseSnapshot.liveOffering.offeringCourse.name,
                        quantity: 1,
                        hs_sku: id_ed, //element.studentQuoteOptionItemId,
                        address: campus,
                      },
                    };

                    console.log(
                      "Propiedades para pasar",
                      JSON.stringify(courseProperties, null, 2)
                    );

                    const lineItemId = await createLineItem(courseProperties);

                    if (lineItemId !== null) {
                      optionLineItems.push(lineItemId);

                      const response = await axios.patch(
                        `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                          lineItemId
                        )}`,
                        {
                          properties: {
                            hubspot_id: lineItemId,
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log(
                        "Line Item actualizado con ID",
                        response.data
                      );
                    } else {
                      console.log("el lieItemId es null");
                    }
                  } else if (
                    element.__typename === "StudentQuoteOptionFeeItem"
                  ) {
                    const feeSnapshot = element.feeSnapshot;
                    const appliedFeePriceItem = element.appliedFeePriceItem;

                    const feeName = feeSnapshot
                      ? feeSnapshot.name
                        ? feeSnapshot.name
                        : "NombreNoDefinido"
                      : "NombreNoDefinido";

                    const feeProperties = {
                      properties: {
                        product_category:
                          element.studentQuoteOptionItemType.codeName,
                        price: appliedFeePriceItem
                          ? appliedFeePriceItem.priceAmount
                          : null,
                        hs_line_item_currency_code: appliedFeePriceItem
                          ? appliedFeePriceItem.priceCurrency.code
                          : null,
                        name: feeName,
                        name_edvisor: feeName,
                        quantity: 1,
                        hs_sku: element.studentQuoteOptionItemId,
                      },
                    };
                    console.log(
                      "Propiedades para pasar",
                      JSON.stringify(feeProperties, null, 2)
                    );

                    const lineItemId = await createLineItem(feeProperties);

                    if (lineItemId !== null) {
                      optionLineItems.push(lineItemId);

                      const response = await axios.patch(
                        `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                          lineItemId
                        )}`,
                        {
                          properties: {
                            hubspot_id: lineItemId,
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log(
                        "Line Item actualizado con ID",
                        response.data
                      );
                    } else {
                      console.log("el lieItemId es null");
                    }
                  } else if (
                    element.__typename === "StudentQuoteOptionDiscountItem"
                  ) {
                    if (
                      "priceAmount" in element.appliedDiscountPriceItem &&
                      "priceCurrency" in element.appliedDiscountPriceItem
                    ) {
                      const discountProperties = {
                        properties: {
                          product_category:
                            element.studentQuoteOptionItemType.codeName,
                          price: element.appliedDiscountPriceItem
                            ? Math.abs(
                                element.appliedDiscountPriceItem.priceAmount
                              )
                            : null,
                          hs_line_item_currency_code:
                            element.appliedDiscountPriceItem
                              ? element.appliedDiscountPriceItem.priceCurrency
                                  .code
                              : null,
                          name: element.promotionSnapshot
                            ? element.promotionSnapshot.name
                              ? element.promotionSnapshot.name
                              : "N/A"
                            : "N/A",
                          name_edvisor: element.promotionSnapshot
                            ? element.promotionSnapshot.name
                              ? element.promotionSnapshot.name
                              : "N/A"
                            : "N/A",
                          quantity: -1,
                          hs_sku: element.studentQuoteOptionItemId,
                          end_date: element.appliedDiscountPriceItem
                            ? element.appliedDiscountPriceItem.endDate
                              ? element.appliedDiscountPriceItem.endDate
                              : ""
                            : "",
                        },
                      };

                      const lineItemId = await createLineItem(discountProperties);

                      if (lineItemId !== null) {
                        optionLineItemsDiscount.push(lineItemId);

                        const response = await axios.patch(
                          `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                            lineItemId
                          )}`,
                          {
                            properties: {
                              hubspot_id: lineItemId,
                            },
                          },
                          {
                            headers: {
                              Authorization: `Bearer ${hubspotApiKey}`,
                              "Content-Type": "application/json",
                            },
                          }
                        );

                        console.log(
                          "Line Item actualizado con ID",
                          response.data
                        );
                      } else {
                        console.log("el lieItemId es null");
                      }

                      const response = await axios.post(
                        `https://api.hubspot.com/crm/v3/objects/discount`,
                        {
                          properties: {
                            hs_type: "FIXED",
                            hs_label: element.promotionSnapshot.name,
                            hs_value: Math.abs(
                              element.appliedDiscountPriceItem.priceAmount
                            ),
                            hs_duration: "ONCE",
                            hs_sort_order: sortOrderCounter.toString(),
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log("Promocion creada", response.data);

                      promotionId = response.data.id;

                      optionPromotions.push(promotionId);

                      sortOrderCounter++;
                    } else {
                      console.log(
                        "Faltan campos obligatorios (Price - Currency )para crear el line item"
                      );
                    }
                  } else if (
                    element.__typename === "StudentQuoteOptionServiceItem"
                  ) {
                    const offeringPriceItem = element.offeringPriceItem;
                    const offering = offeringPriceItem?.offering;

                    const serviceProperties = {
                      properties: {
                        price: offeringPriceItem?.priceAmount ?? null,
                        hs_line_item_currency_code:
                          offeringPriceItem?.priceCurrency?.code ?? null,
                        name: offering?.name ?? "N/A",
                        product_category:
                          element.studentQuoteOptionItemType.codeName,
                        institution: offering?.school?.name ?? "N/A",
                        duration: offeringPriceItem?.durationAmount ?? null,
                        duration_type:
                          offeringPriceItem?.durationType?.codeName ?? null,
                        start_date: offeringPriceItem?.startDate ?? null,
                        end_date: offeringPriceItem?.endDate ?? null,
                        name_edvisor: offering?.name ?? "N/A",
                        quantity: 1,
                        hs_sku: element.studentQuoteOptionItemId,
                      },
                    };

                    console.log(
                      "Propiedades para pasar",
                      JSON.stringify(serviceProperties, null, 2)
                    );

                    const lineItemId = await createLineItem(serviceProperties);

                    if (lineItemId !== null) {
                      optionLineItems.push(lineItemId);

                      const response = await axios.patch(
                        `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                          lineItemId
                        )}`,
                        {
                          properties: {
                            hubspot_id: lineItemId,
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log(
                        "Line Item actualizado con ID",
                        response.data
                      );
                    } else {
                      console.log("el lieItemId es null");
                    }
                  } else if (
                    element.__typename === "StudentQuoteOptionAccommodationItem"
                  ) {
                    // Process accommodation item
                    const offeringPriceItem = element.offeringPriceItem;
                    const offering = offeringPriceItem
                      ? offeringPriceItem.offering
                      : null;

                    const accommodationProperties = {
                      properties: {
                        price: offeringPriceItem
                          ? offeringPriceItem.priceAmount
                          : null,
                        hs_line_item_currency_code: offeringPriceItem
                          ? offeringPriceItem.priceCurrency.code
                          : null,
                        name: offering ? offering.name : "N/A",
                        product_category:
                          element.studentQuoteOptionItemType.codeName,
                        institution: offering ? offering.school.name : "N/A",
                        duration: offeringPriceItem
                          ? offeringPriceItem.durationAmount
                          : null,
                        duration_type: offeringPriceItem
                          ? offeringPriceItem.durationType.codeName
                          : null,
                        start_date: offeringPriceItem
                          ? offeringPriceItem.startDate
                          : null,
                        end_date: offeringPriceItem
                          ? offeringPriceItem.endDate
                          : null,
                        name_edvisor: offering ? offering.name : "N/A",
                        quantity: 1,
                        hs_sku: element.studentQuoteOptionItemId,
                      },
                    };

                    console.log(
                      "Propiedades para pasar",
                      JSON.stringify(accommodationProperties, null, 2)
                    );

                    const lineItemId = await createLineItem(
                      accommodationProperties
                    );

                    if (lineItemId !== null) {
                      optionLineItems.push(lineItemId);

                      const response = await axios.patch(
                        `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                          lineItemId
                        )}`,
                        {
                          properties: {
                            hubspot_id: lineItemId,
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log(
                        "Line Item actualizado con ID",
                        response.data
                      );
                    } else {
                      console.log("el lieItemId es null");
                    }
                  } else if (
                    element.__typename === "StudentQuoteOptionInsuranceItem"
                  ) {
                    // Process accommodation item
                    const offeringPriceItem = element.offeringPriceItem;
                    const offering = offeringPriceItem
                      ? offeringPriceItem.offering
                      : null;

                    const insuranceProperties = {
                      properties: {
                        price: offeringPriceItem
                          ? offeringPriceItem.priceAmount
                          : null,
                        hs_line_item_currency_code: offeringPriceItem
                          ? offeringPriceItem.priceCurrency.code
                          : null,
                        name: offering ? offering.name : "N/A",
                        product_category:
                          element.studentQuoteOptionItemType.codeName,
                        institution: offering ? offering.school.name : "N/A",
                        duration: offeringPriceItem
                          ? offeringPriceItem.durationAmount
                          : null,
                        duration_type: offeringPriceItem
                          ? offeringPriceItem.durationType.codeName
                          : null,
                        start_date: offeringPriceItem
                          ? offeringPriceItem.startDate
                          : null,
                        end_date: offeringPriceItem
                          ? offeringPriceItem.endDate
                          : null,
                        name_edvisor: offering ? offering.name : "N/A",
                        quantity: 1,
                        hs_sku: element.studentQuoteOptionItemId,
                      },
                    };

                    console.log(
                      "Propiedades para pasar",
                      JSON.stringify(insuranceProperties, null, 2)
                    );

                    const lineItemId = await createLineItem(
                      insuranceProperties
                    );

                    if (lineItemId !== null) {
                      optionLineItems.push(lineItemId);

                      const response = await axios.patch(
                        `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                          lineItemId
                        )}`,
                        {
                          properties: {
                            hubspot_id: lineItemId,
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log(
                        "Line Item actualizado con ID",
                        response.data
                      );
                    } else {
                      console.log("el lieItemId es null");
                    }
                  }
                }

                lineItemsValue.push(optionLineItems);

                promotionsValue.push(optionPromotions);

                lineItemsValueDiscount.push(optionLineItemsDiscount)

                console.log(
                  "Los line items para la opción",
                  option.name,
                  "son",
                  optionLineItems
                );

                console.log(
                  "Las promociones obtenidas fueron",
                  optionPromotions
                );

                console.log("Los line Items discounts fueron",optionLineItemsDiscount);
          
              }

              async function createLineItem(lineItemData) {
                try {
                  console.log(
                    "Propiedades que llegaron para crear el line item",
                    lineItemData
                  );

                  let currency =
                    lineItemData.properties.hs_line_item_currency_code;
                  let price = lineItemData.properties.price;

                  if (currency !== currencyDeal) {
                    console.log(
                      "Moneda del LineItem y Negocio distintas",
                      currency,
                      "",
                      currencyDeal
                    );

                    const graphqlResponse = await axios.post(
                      edvisorApiUrl,
                      {
                        query: `
                                query {
                                  agencyCompanyCurrencyRates {
                                    fromCurrency { code }
                                    toCurrency { code }
                                    rate
                                  }
                                }
                              `,
                      },
                      {
                        headers: {
                          Authorization: `Bearer ${edvisorAuthToken}`,
                        },
                      }
                    );

                    const currencyRates =
                      graphqlResponse.data.data.agencyCompanyCurrencyRates;
                    let rateObj;

                    for (let i = 0; i < currencyRates.length; i++) {
                      const rate = currencyRates[i];
                      if (
                        rate.fromCurrency.code === currency &&
                        rate.toCurrency.code === currencyDeal
                      ) {
                        rateObj = rate;
                        break; // Se encontró la tasa de cambio, salimos del bucle.
                      }
                    }

                    const conversionRate = rateObj ? rateObj.rate : 1;
                    price *= conversionRate;

                    const updatedLineItemData = {
                      properties: {
                        ...lineItemData.properties,
                        price: price,
                        hs_line_item_currency_code: currencyDeal,
                      },
                    };

                    const response = await axios.post(
                      "https://api.hubspot.com/crm/v3/objects/line_item",
                      updatedLineItemData,
                      {
                        headers: {
                          Authorization: `Bearer ${hubspotApiKey}`,
                          "Content-Type": "application/json",
                        },
                      }
                    );

                    console.log("Line item creado", response.data);

                    return response.data.id;
                  } else {
                    console.log("Moneda del lineItem y Negocio iguales");

                    const response = await axios.post(
                      "https://api.hubspot.com/crm/v3/objects/line_item",
                      lineItemData,
                      {
                        headers: {
                          Authorization: `Bearer ${hubspotApiKey}`,
                          "Content-Type": "application/json",
                        },
                      }
                    );

                    console.log("Line item creado", response.data);

                    return response.data.id;
                  }
                } catch (error) {
                  console.error("Error al crear el line item:", error);
                  return null;
                }
              }

              // Process total information
              sortedStudentQuoteOptions.forEach((option, index) => {
                const optionName = option.name;
                const newTotalPrice = option.totalPrice;
                const newTotalCurrencyCode = option.priceCurrency.code;
                const newTotalAnotherPrice =
                  option.totalInOriginalCurrenies[0].amount;
                const newTotalAnotherCurrencyCode =
                  option.totalInOriginalCurrenies[0].currency.code;

                if (index === 1) {
                  quoteOptionId1 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                } else if (index === 2) {
                  quoteOptionId2 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                } else if (index === 3) {
                  quoteOptionId3 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                } else if (index === 4) {
                  quoteOptionId4 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                } else if (index === 5) {
                  quoteOptionId5 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                } else if (index === 6) {
                  quoteOptionId6 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                }
              });

              console.log("Los line items totales son", lineItemsValue);

              console.log("Las promociones totales son", promotionsValue);

              console.log("Los line items Discounts totales son", lineItemsValueDiscount);

              //FIND OWNER EDVISOR TO HUBSPOT
              let ownerEdvisor = null;

              try {
                console.log("** UPDATE OWNERS - actualizacion **");

                console.log("Tokens a enviar - hubspotToken", hubspotApiKey);
                console.log("Tokens a enviar - edvisorToken", edvisorAuthToken);

                const client = new LambdaClient();
                const input = {
                  FunctionName: process.env.FUNCTION_NAME,
                  InvocationType: "RequestResponse",
                  Payload: JSON.stringify({
                    HUBSPOT_TOKEN: hubspotApiKey,
                    EDVISOR_TOKEN: edvisorAuthToken,
                  }),
                };
                const command = new InvokeCommand(input);

                const response = await client.send(command);

                agencyIdToSearch = agencyId ? agencyId : parseInt(id_agencia);

                console.log("id de agencia para buscar", agencyIdToSearch);

                console.log("ownerId para pasar", agentId);

                if (
                  agentId !== null ||
                  (agentId !== "" && agentId !== undefined)
                ) {
                  const ownerToSearch = agentId;

                  console.log("owner antes de la funcion", ownerEdvisor);

                  await getEdvisorOwner(
                    `${agencyIdToSearch}`,
                    `${ownerToSearch}`,
                    `${portalIdtoSearch}`
                  )
                    .then((getOwnerId) => {
                      if (
                        getOwnerId !== null &&
                        getOwnerId !== "" &&
                        getOwnerId !== undefined
                      ) {
                        try {
                          console.log(
                            "Se encontró un agente con el ownerId proporcionado async:",
                            getOwnerId
                          );
                          ownerEdvisor = getOwnerId;
                          console.log(
                            "owner asignado justo en la funcion",
                            ownerEdvisor
                          );
                        } catch (error) {
                          console.log(
                            "Error al asginar owner - motivo:",
                            error
                          );
                        }
                      } else {
                        console.log(
                          "No se encontró un agente con el ownerId proporcionado."
                        );
                      }
                    })
                    .catch((error) => {
                      console.log(
                        "No se encontró propietario para asignar",
                        error
                      );
                    });
                } else {
                  console.log("OwnerID vacío en el payload");
                }
              } catch (error) {
                console.log("No se encontro propietario para asignar", error);
              }

              console.log(
                `Valores que se van a cargar en el negocio, totalPrice ${totalPrice}, totalCurrency ${totalCurrency}, totalAnotherPrice ${totalAnotherPrice}, totalAnotherCurrency ${totalAnotherCurrency}`
              );

              console.log("Moneda del negocio", currencyDeal);

              let currency2 = totalCurrency !== "CAD" ? `${totalCurrency}` : "";
              let price2 = totalCurrency !== "CAD" ? `${totalPrice}` : "";

              const dealData = {
                properties: {
                  dealname: `${schoolName} - ${contactFirstname} ${contactLastname}`,
                  pipeline: PIPELINE,
                  dealstage: DEALSTAGE,
                  amount: maxTotalAmount,
                  deal_currency_code: currencyDeal,
                  price: price2,
                  currency_2: currency2,
                  studentquoteid: studentQuoteId,
                  studentid: studentId,
                  statusdealedvisor: true,
                  hubspot_owner_id: `${ownerEdvisor ? ownerEdvisor : ""}`,
                  quote_option_id_1: quoteOptionId1,
                  quote_option_id_2: quoteOptionId2,
                  quote_option_id_3: quoteOptionId3,
                  quote_option_id_4: quoteOptionId4,
                  quote_option_id_5: quoteOptionId5,
                  quote_option_id_6: quoteOptionId6,
                },
                associations: [
                  {
                    to: {
                      id: contactId,
                    },
                    types: [
                      {
                        associationCategory: "HUBSPOT_DEFINED",
                        associationTypeId: 3,
                      },
                    ],
                  },
                ],
              };

              for (let i = 0; i < lineItemsValue.length; i++) {
                const lineItem = lineItemsValue[i];

                // Asociar los IDs de los line items
                for (const lineItemId of lineItem) {
                  const association = {
                    to: {
                      id: lineItemId,
                    },
                    types: [
                      {
                        associationCategory: "HUBSPOT_DEFINED",
                        associationTypeId: 19,
                      },
                    ],
                  };
                  dealData.associations.push(association);
                }
              }

              //asociar line Items Discount al negocio

              for (let i = 0; i < lineItemsValueDiscount.length; i++) {
                const lineItem = lineItemsValueDiscount[i];

                // Asociar los IDs de los line items
                for (const lineItemId of lineItem) {
                  const association = {
                    to: {
                      id: lineItemId,
                    },
                    types: [
                      {
                        associationCategory: "HUBSPOT_DEFINED",
                        associationTypeId: 19,
                      },
                    ],
                  };
                  dealData.associations.push(association);
                }
              }

              try {
                const dealCreate = await axios.post(
                  "https://api.hubspot.com/crm/v3/objects/deal",
                  dealData,
                  {
                    headers: {
                      Authorization: `Bearer ${hubspotApiKey}`,
                      "Content-Type": "application/json",
                    },
                  }
                );

                console.log(
                  "Negocio creado con lineItems asociados",
                  dealCreate.data
                );

                const newDealId = dealCreate.data.id;

                let num = 1;

                for (const lineItems of lineItemsValue) {
                  console.log(`Procesando Option ${num}`);

                  console.log("Line Items:", lineItems);

                  const quoteData = {
                    properties: {
                      hs_title: `${titleQuote} - Option ${num}`,
                      hs_status: quoteStatusFinal || "DRAFT",
                      hs_expiration_date:
                        eventData.after.expires ||
                        new Date(
                          Date.now() + 30 * 24 * 60 * 60 * 1000
                        ).toISOString(),
                      hs_currency: totalAnotherCurrency,
                      studentquoteid: eventData.after.studentQuoteId,
                      hs_template_type: "CUSTOMIZABLE_QUOTE_TEMPLATE",
                      hs_language: "en",
                      hs_comments: `Value of line-items expressed in Canadian dollars (CAD)`,
                      hubspot_owner_id: `${ownerEdvisor ? ownerEdvisor : ""}`,
                      hs_sender_firstname: contactFirstname,
                      hs_sender_lastname: contactLastname,
                      hs_sender_email: contactEmail,
                    },
                    associations: [
                      {
                        to: {
                          id: TEMPLATE_ID, //245775600407 Plantilla de cotizacion Modern Basic
                        },
                        types: [
                          {
                            associationCategory: "HUBSPOT_DEFINED",
                            associationTypeId: 286,
                          },
                        ],
                      },
                      /* {
                            to: {
                              id: contactId
                            },
                            types: [
                              {
                                associationCategory: "HUBSPOT_DEFINED",
                                associationTypeId: 69,
                              },
                            ],
                          }, */
                      {
                        to: {
                          id: dealCreate.data.id,
                        },
                        types: [
                          {
                            associationCategory: "HUBSPOT_DEFINED",
                            associationTypeId: 64,
                          },
                        ],
                      },
                    ],
                  };

                  // Agregar asociación de line items a la cotización
                  for (const lineItemId of lineItems) {
                    const association = {
                      to: {
                        id: lineItemId,
                      },
                      types: [
                        {
                          associationCategory: "HUBSPOT_DEFINED",
                          associationTypeId: 67,
                        },
                      ],
                    };

                    quoteData.associations.push(association);
                  }

                  const quoteResponse = await axios.post(
                    "https://api.hubspot.com/crm/v3/objects/quotes",
                    quoteData,
                    {
                      headers: {
                        Authorization: `Bearer ${hubspotApiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  console.log("A punto de crear la cotizacion");

                  console.log(
                    "Nueva Cotización creada en HubSpot:",
                    quoteResponse.data
                  );

                  const quoteId = quoteResponse.data.id;

                  try {
                    console.log("...Buscando Discount para asociar");

                    // Verificamos si hay descuentos para esta cotización
                    if (
                      promotionsValue[num - 1] &&
                      promotionsValue[num - 1].length > 0
                    ) {
                      const promotions = promotionsValue[num - 1]; // Utilizamos num - 1 para obtener el índice correcto

                      // Iteramos sobre los descuentos asociados a la cotización actual
                      for (const promotionId of promotions) {
                        const updateQuote = await axios.put(
                          `https://api.hubspot.com/crm/v4/objects/quotes/${quoteId}/associations/default/discounts/${promotionId}`,
                          {},
                          {
                            headers: {
                              Authorization: `Bearer ${hubspotApiKey}`,
                              "Content-Type": "application/json",
                            },
                          }
                        );

                        console.log(
                          "Cotizacion actualizada",
                          quoteId,
                          "con el siguiente Descuento",
                          promotionId
                        );
                      }
                    }
                  } catch (error) {
                    console.error("Error", error);
                  }

                  await axios.patch(
                    `https://api.hubspot.com/crm/v3/objects/deal/${newDealId}`,
                    {
                      properties: {
                        [`quote_option_id_${num}`]: `Option ${num} ; ${quoteId}`,
                      },
                      associations: {
                        to: {
                          id: quoteId,
                        },
                        types: [
                          {
                            associationCategory: "HUBSPOT_DEFINED",
                            associationTypeId: 63,
                          },
                        ],
                      },
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${hubspotApiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );
                  num++;
                }
              } catch (error) {
                console.error("Error al crear negocio y cotización", error);
              }
            } catch (error) {
              console.error("No se pudo crear el contacto", error);
            }
          } catch (error) {
            console.error(
              "Error en creacion del contacto dentro de la cotizacion",
              error
            );
          }
        }
      } catch (error) {
        console.error("Error al crear cotizacion", error);
      }
    }

    if (eventType === "studentQuote:update") {
      try {

        console.log('actualizacion');
        console.log("quoteId", eventData.after.studentQuoteId);
        console.log("studentId", eventData.after.studentId);
        console.log("agentId", eventData.after.agentUserId);
        console.log("notes", eventData.after.notes);
        console.log("fecha de creacion", eventData.after.created);

        const studentQuoteId = eventData.after.studentQuoteId;
        const titleQuote = eventData.after.externalId;
        const studentId = eventData.after.studentId;
        const agentId = eventData.after.agentUserId;

        /* try {
          const refreshToken = await getAccessToken(agencyCompanyId);

          if (!refreshToken) {
            return "No se encontró el AgencyID en DynamoDB.";
          } else {
            hubspotApiKey = refreshToken;

            console.log("hubspotApiKey", hubspotApiKey);
          }
        } catch (error) {
          console.error("Error durante la ejecución:", error);
        } */

        const getAgency = await axios.post(
          edvisorApiUrl,
          {
            query: `
            query{
              student(studentId:${studentId}){
               agencyId
               metadata
              }
            }
            `,
          },
          {
            headers: {
              Authorization: `Bearer ${edvisorAuthToken}`,
            },
          }
        );

        console.log('edvisorAuthToken',edvisorAuthToken);

        console.log('getAgency.data',getAgency.data);

        console.log('getAgency.data.data',getAgency.data.data);

        console.log('getAgency.data.data.student',getAgency.data.data.student);

        console.log('getAgency.data.data.student.agencyId',getAgency.data.data.student.agencyId);

        agencyId = getAgency.data.data.student.agencyId;


        const searchPortalId = await axios.get(
          `https://api.hubspot.com/account-info/v3/details`,
          {
            headers: {
              Authorization: `Bearer ${hubspotApiKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        const portalIdToUse = searchPortalId.data.portalId;

        //FIND CONTACT BY STUDENTID

        const searchResponse = await axios.post(
          `https://api.hubspot.com/crm/v3/objects/contacts/search`,
          {
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: "studentid",
                    operator: "EQ",
                    value: studentId,
                  },
                ],
              },
            ],
            properties: ["hubspot_owner_id", "firstname", "lastname"],
          },
          {
            headers: {
              Authorization: `Bearer ${hubspotApiKey}`,
            },
          }
        );

        //SEARCH CONTACT IN HUBSPOT BY STUDENTID

        if (searchResponse.data.total > 0) {
          console.log("Encontro el contacto en HubSpot por StudentId");

          let hsContactId = searchResponse.data.results[0].id;
          let owner = "";
          let contactId;
          let contactFirstname = "";
          let contactLastname = "";
          let contactEmail = "";
          let contactName = searchResponse.data.results[0].properties.firstname;
          let contactLName = searchResponse.data.results[0].properties.lastname;

          if (searchResponse.data.results[0].properties.hubspot_owner_id) {
            owner = searchResponse.data.results[0].properties.hubspot_owner_id;

            try {
              const searchOwner = await axios.get(
                `https://api.hubspot.com/crm/v3/owners/${owner}`,
                {
                  headers: {
                    Authorization: `Bearer ${hubspotApiKey}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              contactId = searchOwner.data.id;
              contactFirstname = searchOwner.data.firstName;
              contactLastname = searchOwner.data.lastName;
              contactEmail = searchOwner.data.email;

              console.log("Email del propiertario ", contactEmail);
            } catch (error) {
              if (error.response) {
                console.error(
                  "Error de respuesta del servidor:",
                  error.response.data
                );
              } else if (error.request) {
                console.error(
                  "No se recibió respuesta del servidor:",
                  error.request
                );
              } else {
                console.error(
                  "Error al configurar la solicitud:",
                  error.message
                );
              }
              return;
            }
          } else {
            console.log("Contacto sin propietario");
          }

          const searchDealByQuoteId = await axios.post(
            `https://api.hubspot.com/crm/v3/objects/deals/search`,
            {
              filterGroups: [
                {
                  filters: [
                    {
                      propertyName: "studentquoteid",
                      operator: "EQ",
                      value: studentQuoteId,
                    },
                  ],
                },
              ],
            },
            {
              headers: {
                Authorization: `Bearer ${hubspotApiKey}`,
              },
            }
          );

          if (searchDealByQuoteId.data.total > 0) {
            const dealIdToSearch = searchDealByQuoteId.data.results[0].id;

            let continueCod = true;

            //SEARCH QUOTES

            try {
              console.log(
                "Encontro el negocio que quieres actualizar, su ID es: ",
                dealIdToSearch
              );

              const searchQuotesDeal = await axios.post(
                `https://api.hubspot.com/crm/v4/associations/deals/quotes/batch/read`,
                {
                  inputs: [
                    {
                      id: dealIdToSearch,
                    },
                  ],
                },
                {
                  headers: {
                    Authorization: `Bearer ${hubspotApiKey}`,
                  },
                }
              );

              const results = searchQuotesDeal.data.results;

              if (results && results.length > 0) {
                console.log("Valores encontrados:", results);

                console.log(
                  "lo que obtuve del searchQuotesDeal",
                  searchQuotesDeal.data
                );

                const toObjectIds = searchQuotesDeal.data.results[0].to.map(
                  (item) => item.toObjectId
                );

                console.log("Quotes encontradas", toObjectIds);

                for (const quoteId of toObjectIds) {
                  try {
                    console.log("QuoteId", quoteId);

                    const searchLineItems = await axios.post(
                      `https://api.hubspot.com/crm/v4/associations/quotes/line_items/batch/read`,
                      {
                        inputs: [
                          {
                            id: quoteId,
                          },
                        ],
                      },
                      {
                        headers: {
                          Authorization: `Bearer ${hubspotApiKey}`,
                        },
                      }
                    );

                    const lineItemsIds = searchLineItems.data.results[0].to.map(
                      (item) => item.toObjectId
                    );

                    console.log("Line imtes encontrados", lineItemsIds);

                    for (const lineItemId of lineItemsIds) {
                      console.log("Line Item a eliminar", lineItemId);

                      const deleteLineItem = await axios.delete(
                        `https://api.hubspot.com/crm/v3/objects/line_item/${lineItemId}`,
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                          },
                        }
                      );

                      console.log(`Line Item eliminado ${lineItemId}`);
                    }
                  } catch (error) {
                    console.error("Error al eliminar line items");
                  }

                  try {
                    console.log("el QuoteID a eliminar es: ", quoteId);

                    const deleteQuotes = await axios.delete(
                      `https://api.hubspot.com/crm/v3/objects/quotes/${quoteId}`,
                      {
                        headers: {
                          Authorization: `Bearer ${hubspotApiKey}`,
                        },
                      }
                    );

                    console.log("QuoteID eliminado");
                  } catch (error) {
                    console.log("Error al eliminar quoteId", quoteId);
                  }
                }

                console.log("Todos las Quotes y Line_Items fueron eliminados");
              } else {
                console.log("No se encontraron valores.");
                continueCod = false;
              }
            } catch (error) {
              console.error("Error buscar/eliminar Quotes", error);
              continueCod = false;
            }

            //SEARCH DEAL BY STUDENTQUOTEID FOR UPDATE

            //STATUS "STEND","DRAFT"

            if (continueCod) {
              const graphqlResponse = await axios.post(
                edvisorApiUrl,
                {
                  query: `
                          query {
                            studentQuote(studentQuoteId: ${studentQuoteId}) {
                              studentQuoteStatus {
                                codeName
                              }
                            }
                          }
                        `,
                },
                {
                  headers: {
                    Authorization: `Bearer ${edvisorAuthToken}`,
                  },
                }
              );

              let quoteStatus =
                graphqlResponse.data.data.studentQuote.studentQuoteStatus
                  .codeName;
              let quoteStatusFinal = "";

              if (quoteStatus == "SENT") {
                quoteStatusFinal = "APPROVED";
              } else if (quoteStatus == "DRAFT") {
                quoteStatusFinal = "DRAFT";
              } else if (quoteStatus == "EXPIRED") {
                quoteStatusFinal = "REJECTED";
              } else if (quoteStatus == "ACCEPTED") {
                quoteStatusFinal = "APPROVED";
              }

              console.log("quoteStatus de Edvisor", quoteStatus);

              console.log("quoteStatusFinal para pasar", quoteStatusFinal);

              console.log("respuesta de primer query", graphqlResponse);

              const graphqlResponse4 = await axios.post(
                edvisorApiUrl,
                {
                  query: `query {
                    studentQuote(studentQuoteId:${studentQuoteId}) {
                      studentQuoteId
                      # optional: add any student quote field 46684083
                      studentQuoteStatus {
                        studentQuoteStatusId
                        codeName
                      }
                      agency {
                        agencyId
                        # optional: add any agency field
                      }
                      student {
                        studentId
                        # optional: add any student field
                      }
                      agentUser {
                        userId
                        # optional: add any user field 
                      }
                      language {
                        code
                      }
                      filterStudentCurrentCountry {
                        countryId
                        code
                      }
                      filterEligibleStudentNationalityCountry {
                        countryId
                        code
                      }
                      studentQuoteOptions {
                        name
                        isAccepted
                        totalPrice
                        priceCurrencyId
                        notes,
                        studentQuoteOptionItems {
                          __typename
                          ... on StudentQuoteOptionCourseItem {
                            studentQuoteOptionItemId
                            studentQuoteOptionItemTypeId
                            studentQuoteOptionItemType {
                              studentQuoteOptionItemTypeId
                              codeName
                            }
                            isAgencyItem
                            offeringPriceItem {
                              priceAmount
                              priceCurrency{
                                code
                              }
                              offeringId
                              durationAmount
                              durationTypeId
                              durationType{
                                codeName
                              }
                              startDate
                              endDate
                            }
                            courseSnapshot {
                              liveOffering{
                                offeringCourse{
                                  name
                                }
                                school{
                                  name
                                }
                              }
                              offeringId
                              offeringCourseCategoryId
                              name
                            }
                          }
                          ... on StudentQuoteOptionInsuranceItem {
                            studentQuoteOptionItemId
                            studentQuoteOptionItemTypeId
                            studentQuoteOptionItemType {
                              studentQuoteOptionItemTypeId
                              codeName
                            }
                            isAgencyItem
                            offeringPriceItem {
                              offeringId
                              offering{
                                name
                                school{
                                  name
                                }
                              }
                              durationAmount
                              durationTypeId
                              startDate
                              endDate
                              durationType{
                                codeName
                              }
                              priceAmount
                              priceCurrency{
                                code
                              }
                            }
                            insuranceSnapshot {
                              offeringId
                              name
                            }
                          }
                          ... on StudentQuoteOptionAccommodationItem {
                            
                            studentQuoteOptionItemId
                            studentQuoteOptionItemTypeId
                            studentQuoteOptionItemType {
                              studentQuoteOptionItemTypeId
                              codeName
                            }
                            isAgencyItem
                            offeringPriceItem {
                              offeringId
                              offering{
                                name
                                school{
                                  name
                                }
                              }
                              durationAmount
                              durationTypeId
                              startDate
                              endDate
                              durationType{
                                codeName
                              }
                              priceAmount
                              priceCurrency{
                                code
                              }
                            }
                            accommodationSnapshot {
                              offeringId
                              offeringAccommodationCategoryId
                              bathroomTypeId
                              roomTypeId
                              mealTypeId
                              name
                            }
                          }
                          ... on StudentQuoteOptionServiceItem {
                            studentQuoteOptionItemId
                            studentQuoteOptionItemType {
                              codeName
                            }
                            isAgencyItem
                            offeringPriceItem {
                              offering{
                                school{
                                  name
                                }
                              }
                              offeringId
                              durationAmount
                              durationTypeId
                              durationType{
                                codeName
                              }
                              startDate
                              endDate
                              priceAmount
                              priceCurrency{
                                code
                              }
                              offering{
                                name
                              }
                            }
                            serviceSnapshot {
                              offeringId
                              serviceQuantity
                              name
                            }
                          }
                          
                          ... on StudentQuoteOptionFeeItem {
                            studentQuoteOptionItemId
                            studentQuoteOptionItemType {
                              codeName
                            }
                            isAgencyItem
                            appliedFeePriceItem {
                              priceAmount
                              priceCurrency{
                                code
                              }
                              feeId
                              appliedToOfferingId
                              durationAmount
                              durationTypeId
                              startDate
                              endDate
                            }
                            feeSnapshot {
                              feeId
                              name
                            }
                          }
                          ... on StudentQuoteOptionDiscountItem {
                            studentQuoteOptionItemId
                            studentQuoteOptionItemType {
                              codeName
                            }
                            isAgencyItem
                            promotionSnapshot {
                              promotionId
                              name
                            }
                            appliedDiscountPriceItem {
                              ... on AppliedAmountOffDiscountPriceItem {
                                promotionId
                                promotion {
                                  name
                                }
                                priceAmount
                                priceCurrency {
                                  currencyId
                                  code
                                  symbol
                                }
                                appliedToOffering {
                                  offeringId
                                  # optional: add any field on an offering
                                }
                                endDate
                              }
                              ... on AppliedDurationExtensionDiscountPriceItem {
                                promotionId
                                priceAmount
                                priceCurrency {
                                  currencyId
                                  code
                                  symbol
                                }
                                endDate
                                extensionDurationType {
                                  durationTypeId
                                  codeName
                                }
                                extensionDurationAmount
                                promotion {
                                  name
                                }
                                appliedToOffering {
                                  offeringId
                                  # optional: add any offering field
                                }
                              }
                              ... on AppliedCustomDiscountPriceItem {
                                promotionId
                                promotion {
                                  name
                                }
                                appliedToOffering {
                                  offeringId
                                  # optional: add any offering field
                                }
                                endDate
                                discountDescription
                              }
                              # ... on moreDiscountPriceItem types will be supported in the future
                            }
                          }
                        }
                        studentQuoteOptionFiles {
                          fileId
                          uploaderUserId
                          mimeType
                          fileExtension
                          name
                          path
                          url
                        },
                        totalPrice,
                          totalInOriginalCurrenies{
                            amount
                            currency{
                              code
                            }
                          }
                          priceCurrency {
                            code
                          }
                      }
                    }
                  }`,
                },
                {
                  headers: {
                    Authorization: `Bearer ${edvisorAuthToken}`,
                  },
                }
              );

              const studentQuoteOptions =
                graphqlResponse4.data.data.studentQuote.studentQuoteOptions;

              const sortedStudentQuoteOptions = [...studentQuoteOptions].sort(
                (a, b) => a.name.localeCompare(b.name)
              );

              console.log(
                "studentQuoteOptions ordenadas por nombre:",
                sortedStudentQuoteOptions
              );

              const maxTotalAmount = Math.max(
                ...sortedStudentQuoteOptions.map(
                  (option) => option.totalInOriginalCurrenies[0].amount
                )
              );

              const currencyDeal =
                sortedStudentQuoteOptions[0].totalInOriginalCurrenies[0]
                  .currency.code;

              console.log("Moneda para el negocio", currencyDeal);

              const lineItemsValue = [];
              const promotionsValue = [];
              const lineItemsValueDiscount = [];
              let totalPrice = 0;
              let totalCurrency = "";
              let totalAnotherPrice = 0;
              let totalAnotherCurrency = "";

              let schoolName;
              let startDate;
              let endDate;
              let durationAmount;
              let durantionDays;
              let campus;
              let quoteOptionId1 = null;
              let quoteOptionId2 = null;
              let quoteOptionId3 = null;
              let quoteOptionId4 = null;
              let quoteOptionId5 = null;
              let quoteOptionId6 = null;
              let promotionId = 0;
              let sortOrderCounter = 1;

              for (let i = 0; i < sortedStudentQuoteOptions.length; i++) {
                const option = sortedStudentQuoteOptions[i];
                let optionLineItems = [];
                let optionPromotions = [];
                let optionLineItemsDiscount = [];

                for (
                  let j = 0;
                  j < option.studentQuoteOptionItems.length;
                  j++
                ) {
                  let element = option.studentQuoteOptionItems[j];

                  if (element.__typename === "StudentQuoteOptionCourseItem") {

                    const courseName = (element.courseSnapshot?.liveOffering?.offeringCourse?.name) ?? 'null';
                    const priceAmountCourse = (element.offeringPriceItem?.priceAmount) ?? 'null';
                    const currencyCourse = (element.offeringPriceItem?.priceCurrency?.code) ?? 'null';
                    const category = (element.studentQuoteOptionItemType?.codeName) ?? 'null';
                    const id_ed = element.studentQuoteOptionItemId ?? 'null';
                    schoolName = (element.courseSnapshot?.liveOffering?.school?.name) ?? 'null';
                    startDate = (element.offeringPriceItem?.startDate) ?? 'null';
                    endDate = (element.offeringPriceItem?.endDate) ?? 'null';
                    durationAmount = (element.offeringPriceItem?.durationAmount) ?? 'null';
                    durantionDays = (element.offeringPriceItem?.durationType?.codeName) ?? 'null';
                    campus = (element.courseSnapshot?.liveOffering?.school?.address) ?? 'null';

                    /* const courseName =
                      element.courseSnapshot.liveOffering.offeringCourse.name;
                    const priceAmountCourse =
                      element.offeringPriceItem.priceAmount;
                    const currencyCourse =
                      element.offeringPriceItem.priceCurrency.code;
                    const category =
                      element.studentQuoteOptionItemType.codeName;
                    const id_ed = element.studentQuoteOptionItemId;
                    schoolName =
                      schoolName ||
                      element.courseSnapshot.liveOffering.school.name;
                    startDate = element.offeringPriceItem.startDate;
                    endDate = element.offeringPriceItem.endDate;
                    durationAmount = element.offeringPriceItem.durationAmount;
                    durantionDays =
                      element.offeringPriceItem.durationType.codeName;
                    campus = element.courseSnapshot.liveOffering.school.address;

                    schoolName =
                      element.courseSnapshot.liveOffering.school.name;
                    startDate = element.offeringPriceItem.startDate;
                    endDate = element.offeringPriceItem.endDate;
                    durationAmount = element.offeringPriceItem.durationAmount;
                    durantionDays =
                      element.offeringPriceItem.durationType.codeName; */

                    // Process course item
                    const courseProperties = {
                      properties: {
                        price: priceAmountCourse, //element.offeringPriceItem.priceAmount,
                        hs_line_item_currency_code: currencyCourse, //element.offeringPriceItem.priceCurrency.code,
                        name: courseName, //element.courseSnapshot.name,
                        product_category: category, //element.studentQuoteOptionItemType.codeName,
                        institution: schoolName, //element.courseSnapshot.liveOffering.school.name,
                        duration: durationAmount, //element.offeringPriceItem.durationAmount,
                        duration_type: durantionDays, //element.offeringPriceItem.durationType.codeName,
                        start_date: startDate, //element.offeringPriceItem.startDate,
                        end_date: endDate, //element.offeringPriceItem.endDate,
                        name_edvisor: courseName, //element.courseSnapshot.liveOffering.offeringCourse.name,
                        quantity: 1,
                        hs_sku: id_ed, //element.studentQuoteOptionItemId,
                        address: campus,
                      },
                    };

                    console.log(
                      "Propiedades para pasar",
                      JSON.stringify(courseProperties, null, 2)
                    );

                    const lineItemId = await createLineItem(courseProperties);

                    if (lineItemId !== null) {
                      optionLineItems.push(lineItemId);

                      const response = await axios.patch(
                        `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                          lineItemId
                        )}`,
                        {
                          properties: {
                            hubspot_id: lineItemId,
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log(
                        "Line Item actualizado con ID",
                        response.data
                      );
                    } else {
                      console.log("el lieItemId es null");
                    }
                  } else if (
                    element.__typename === "StudentQuoteOptionFeeItem"
                  ) {
                    const feeSnapshot = element.feeSnapshot;
                    const appliedFeePriceItem = element.appliedFeePriceItem;

                    const feeName = feeSnapshot
                      ? feeSnapshot.name
                        ? feeSnapshot.name
                        : "NombreNoDefinido"
                      : "NombreNoDefinido";

                    const feeProperties = {
                      properties: {
                        product_category:
                          element.studentQuoteOptionItemType.codeName,
                        price: appliedFeePriceItem
                          ? appliedFeePriceItem.priceAmount
                          : null,
                        hs_line_item_currency_code: appliedFeePriceItem
                          ? appliedFeePriceItem.priceCurrency.code
                          : null,
                        name: feeName,
                        name_edvisor: feeName,
                        quantity: 1,
                        hs_sku: element.studentQuoteOptionItemId,
                      },
                    };

                    console.log(
                      "Propiedades para pasar",
                      JSON.stringify(feeProperties, null, 2)
                    );

                    const lineItemId = await createLineItem(feeProperties);

                    if (lineItemId !== null) {
                      optionLineItems.push(lineItemId);

                      const response = await axios.patch(
                        `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                          lineItemId
                        )}`,
                        {
                          properties: {
                            hubspot_id: lineItemId,
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log(
                        "Line Item actualizado con ID",
                        response.data
                      );
                    } else {
                      console.log("el lieItemId es null");
                    }
                  } else if (
                    element.__typename === "StudentQuoteOptionDiscountItem"
                  ) {
                    if (
                      "priceAmount" in element.appliedDiscountPriceItem &&
                      "priceCurrency" in element.appliedDiscountPriceItem
                    ) {
                      const discountProperties = {
                        properties: {
                          product_category:
                            element.studentQuoteOptionItemType.codeName,
                          price: element.appliedDiscountPriceItem
                            ? Math.abs(
                                element.appliedDiscountPriceItem.priceAmount
                              )
                            : null,
                          hs_line_item_currency_code:
                            element.appliedDiscountPriceItem
                              ? element.appliedDiscountPriceItem.priceCurrency
                                  .code
                              : null,
                          name: element.promotionSnapshot
                            ? element.promotionSnapshot.name
                              ? element.promotionSnapshot.name
                              : "N/A"
                            : "N/A",
                          name_edvisor: element.promotionSnapshot
                            ? element.promotionSnapshot.name
                              ? element.promotionSnapshot.name
                              : "N/A"
                            : "N/A",
                          quantity: -1,
                          hs_sku: element.studentQuoteOptionItemId,
                          end_date: element.appliedDiscountPriceItem
                            ? element.appliedDiscountPriceItem.endDate
                              ? element.appliedDiscountPriceItem.endDate
                              : ""
                            : "",
                        },
                      };

                      const lineItemId = await createLineItem(discountProperties);

                      if (lineItemId !== null) {
                        optionLineItemsDiscount.push(lineItemId);

                        const response = await axios.patch(
                          `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                            lineItemId
                          )}`,
                          {
                            properties: {
                              hubspot_id: lineItemId,
                            },
                          },
                          {
                            headers: {
                              Authorization: `Bearer ${hubspotApiKey}`,
                              "Content-Type": "application/json",
                            },
                          }
                        );

                        console.log(
                          "Line Item actualizado con ID",
                          response.data
                        );
                      } else {
                        console.log("el lieItemId es null");
                      }

                      const response = await axios.post(
                        `https://api.hubspot.com/crm/v3/objects/discount`,
                        {
                          properties: {
                            hs_type: "FIXED",
                            hs_label: element.promotionSnapshot.name,
                            hs_value: Math.abs(
                              element.appliedDiscountPriceItem.priceAmount
                            ),
                            hs_duration: "ONCE",
                            hs_sort_order: sortOrderCounter.toString(),
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log("Promocion creada", response.data);

                      promotionId = response.data.id;

                      optionPromotions.push(promotionId);

                      sortOrderCounter++;
                    } else {
                      console.log(
                        "Faltan campos obligatorios (Price - Currency )para crear el line item"
                      );
                    }
                  } else if (
                    element.__typename === "StudentQuoteOptionServiceItem"
                  ) {
                    // Process service item
                    const offeringPriceItem = element.offeringPriceItem;
                    const offering = offeringPriceItem?.offering;

                    const serviceProperties = {
                      properties: {
                        price: offeringPriceItem?.priceAmount ?? null,
                        hs_line_item_currency_code:
                          offeringPriceItem?.priceCurrency?.code ?? null,
                        name: offering?.name ?? "N/A",
                        product_category:
                          element.studentQuoteOptionItemType.codeName,
                        institution: offering?.school?.name ?? "N/A",
                        duration: offeringPriceItem?.durationAmount ?? null,
                        duration_type:
                          offeringPriceItem?.durationType?.codeName ?? null,
                        start_date: offeringPriceItem?.startDate ?? null,
                        end_date: offeringPriceItem?.endDate ?? null,
                        name_edvisor: offering?.name ?? "N/A",
                        quantity: 1,
                        hs_sku: element.studentQuoteOptionItemId,
                      },
                    };

                    console.log(
                      "Propiedades para pasar",
                      JSON.stringify(serviceProperties, null, 2)
                    );

                    const lineItemId = await createLineItem(serviceProperties);

                    if (lineItemId !== null) {
                      optionLineItems.push(lineItemId);

                      const response = await axios.patch(
                        `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                          lineItemId
                        )}`,
                        {
                          properties: {
                            hubspot_id: lineItemId,
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log(
                        "Line Item actualizado con ID",
                        response.data
                      );
                    } else {
                      console.log("el lieItemId es null");
                    }
                  } else if (
                    element.__typename === "StudentQuoteOptionAccommodationItem"
                  ) {
                    const offeringPriceItem = element.offeringPriceItem;
                    const offering = offeringPriceItem
                      ? offeringPriceItem.offering
                      : null;

                    const accommodationProperties = {
                      properties: {
                        price: offeringPriceItem
                          ? offeringPriceItem.priceAmount
                          : null,
                        hs_line_item_currency_code: offeringPriceItem
                          ? offeringPriceItem.priceCurrency.code
                          : null,
                        name: offering ? offering.name : "N/A",
                        product_category:
                          element.studentQuoteOptionItemType.codeName,
                        institution: offering ? offering.school.name : "N/A",
                        duration: offeringPriceItem
                          ? offeringPriceItem.durationAmount
                          : null,
                        duration_type: offeringPriceItem
                          ? offeringPriceItem.durationType.codeName
                          : null,
                        start_date: offeringPriceItem
                          ? offeringPriceItem.startDate
                          : null,
                        end_date: offeringPriceItem
                          ? offeringPriceItem.endDate
                          : null,
                        name_edvisor: offering ? offering.name : "N/A",
                        quantity: 1,
                        hs_sku: element.studentQuoteOptionItemId,
                      },
                    };

                    console.log(
                      "Propiedades para pasar",
                      JSON.stringify(accommodationProperties, null, 2)
                    );

                    const lineItemId = await createLineItem(
                      accommodationProperties
                    );

                    if (lineItemId !== null) {
                      optionLineItems.push(lineItemId);

                      const response = await axios.patch(
                        `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                          lineItemId
                        )}`,
                        {
                          properties: {
                            hubspot_id: lineItemId,
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log(
                        "Line Item actualizado con ID",
                        response.data
                      );
                    } else {
                      console.log("el lieItemId es null");
                    }
                  } else if (
                    element.__typename === "StudentQuoteOptionInsuranceItem"
                  ) {
                    // Process accommodation item
                    const offeringPriceItem = element.offeringPriceItem;
                    const offering = offeringPriceItem
                      ? offeringPriceItem.offering
                      : null;

                    const insuranceProperties = {
                      properties: {
                        price: offeringPriceItem
                          ? offeringPriceItem.priceAmount
                          : null,
                        hs_line_item_currency_code: offeringPriceItem
                          ? offeringPriceItem.priceCurrency.code
                          : null,
                        name: offering ? offering.name : "N/A",
                        product_category:
                          element.studentQuoteOptionItemType.codeName,
                        institution: offering ? offering.school.name : "N/A",
                        duration: offeringPriceItem
                          ? offeringPriceItem.durationAmount
                          : null,
                        duration_type: offeringPriceItem
                          ? offeringPriceItem.durationType.codeName
                          : null,
                        start_date: offeringPriceItem
                          ? offeringPriceItem.startDate
                          : null,
                        end_date: offeringPriceItem
                          ? offeringPriceItem.endDate
                          : null,
                        name_edvisor: offering ? offering.name : "N/A",
                        quantity: 1,
                        hs_sku: element.studentQuoteOptionItemId,
                      },
                    };

                    console.log(
                      "Propiedades para pasar",
                      JSON.stringify(insuranceProperties, null, 2)
                    );

                    const lineItemId = await createLineItem(
                      insuranceProperties
                    );

                    if (lineItemId !== null) {
                      optionLineItems.push(lineItemId);

                      const response = await axios.patch(
                        `https://api.hubspot.com/crm/v3/objects/line_item/${parseInt(
                          lineItemId
                        )}`,
                        {
                          properties: {
                            hubspot_id: lineItemId,
                          },
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log(
                        "Line Item actualizado con ID",
                        response.data
                      );
                    } else {
                      console.log("el lieItemId es null");
                    }
                  }
                }

                lineItemsValue.push(optionLineItems);

                promotionsValue.push(optionPromotions);

                lineItemsValueDiscount.push(optionLineItemsDiscount);

                console.log(
                  "Los line items para la opción",
                  option.name,
                  "son",
                  optionLineItems
                );

                console.log(
                  "Las promociones obtenidas fueron",
                  optionPromotions
                );

                console.log("Los line Items discounts fueron",optionLineItemsDiscount);
          
              }

              async function createLineItem(lineItemData) {
                try {
                  console.log(
                    "Propiedades que llegaron para crear el line item",
                    lineItemData
                  );

                  let currency =
                    lineItemData.properties.hs_line_item_currency_code;
                  let price = lineItemData.properties.price;

                  if (currency !== currencyDeal) {
                    console.log(
                      "Moneda del LineItem y Negocio distintas",
                      currency,
                      "",
                      currencyDeal
                    );

                    const graphqlResponse = await axios.post(
                      edvisorApiUrl,
                      {
                        query: `
                                query {
                                  agencyCompanyCurrencyRates {
                                    fromCurrency { code }
                                    toCurrency { code }
                                    rate
                                  }
                                }
                              `,
                      },
                      {
                        headers: {
                          Authorization: `Bearer ${edvisorAuthToken}`,
                        },
                      }
                    );

                    const currencyRates =
                      graphqlResponse.data.data.agencyCompanyCurrencyRates;
                    let rateObj;

                    for (let i = 0; i < currencyRates.length; i++) {
                      const rate = currencyRates[i];
                      if (
                        rate.fromCurrency.code === currency &&
                        rate.toCurrency.code === currencyDeal
                      ) {
                        rateObj = rate;
                        break; // Se encontró la tasa de cambio, salimos del bucle.
                      }
                    }

                    const conversionRate = rateObj ? rateObj.rate : 1;
                    price *= conversionRate;

                    const updatedLineItemData = {
                      properties: {
                        ...lineItemData.properties,
                        price: price,
                        hs_line_item_currency_code: currencyDeal,
                      },
                    };

                    const response = await axios.post(
                      "https://api.hubspot.com/crm/v3/objects/line_item",
                      updatedLineItemData,
                      {
                        headers: {
                          Authorization: `Bearer ${hubspotApiKey}`,
                          "Content-Type": "application/json",
                        },
                      }
                    );

                    console.log("Line item creado", response.data);

                    return response.data.id;
                  } else {
                    console.log("Moneda del lineItem y Negocio iguales");

                    const response = await axios.post(
                      "https://api.hubspot.com/crm/v3/objects/line_item",
                      lineItemData,
                      {
                        headers: {
                          Authorization: `Bearer ${hubspotApiKey}`,
                          "Content-Type": "application/json",
                        },
                      }
                    );

                    console.log("Line item creado", response.data);

                    return response.data.id;
                  }
                } catch (error) {
                  console.error("Error al crear el line item:", error);
                  return null;
                }
              }

              // Process total information
              sortedStudentQuoteOptions.forEach((option, index) => {
                const optionName = option.name;
                const newTotalPrice = option.totalPrice;
                const newTotalCurrencyCode = option.priceCurrency.code;
                const newTotalAnotherPrice =
                  option.totalInOriginalCurrenies[0].amount;
                const newTotalAnotherCurrencyCode =
                  option.totalInOriginalCurrenies[0].currency.code;

                if (index === 1) {
                  quoteOptionId1 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                } else if (index === 2) {
                  quoteOptionId2 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                } else if (index === 3) {
                  quoteOptionId3 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                } else if (index === 4) {
                  quoteOptionId4 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                } else if (index === 5) {
                  quoteOptionId5 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                } else if (index === 6) {
                  quoteOptionId6 = optionName;
                  totalPrice += newTotalPrice;
                  totalCurrency = newTotalCurrencyCode;
                  totalAnotherPrice += newTotalAnotherPrice;
                  totalAnotherCurrency = newTotalAnotherCurrencyCode;
                }
              });

              console.log("Los line items totales son", lineItemsValue);

              console.log("Las promociones totales son", promotionsValue);

              console.log("Los line items Discounts totales son", lineItemsValueDiscount);


              //FIND OWNER EDVISOR TO HUBSPOT
              let ownerEdvisor = null;

              try {
                console.log("** UPDATE OWNERS - Actualizacion **");

                console.log("Tokens a enviar - hubspotToken", hubspotApiKey);
                console.log("Tokens a enviar - edvisorToken", edvisorAuthToken);

                const client = new LambdaClient();
                const input = {
                  FunctionName: process.env.FUNCTION_NAME,
                  InvocationType: "RequestResponse",
                  Payload: JSON.stringify({
                    HUBSPOT_TOKEN: hubspotApiKey,
                    EDVISOR_TOKEN: edvisorAuthToken,
                  }),
                };
                const command = new InvokeCommand(input);
                const response = await client.send(command);

                console.log("id_agency de payload", agencyId);

                agencyIdToSearch = agencyId ? agencyId : parseInt(id_agencia);

                console.log("id de agencia para buscar", agencyIdToSearch);

                console.log("ownerId para pasar", agentId);

                if (
                  agentId !== null ||
                  (agentId !== "" && agentId !== undefined)
                ) {
                  const ownerToSearch = agentId;

                  console.log("owner antes de la funcion", ownerEdvisor);

                  await getEdvisorOwner(
                    `${agencyIdToSearch}`,
                    `${ownerToSearch}`,
                    `${portalIdtoSearch}`
                  )
                    .then((getOwnerId) => {
                      if (
                        getOwnerId !== null &&
                        getOwnerId !== "" &&
                        getOwnerId !== undefined
                      ) {
                        try {
                          console.log(
                            "Se encontró un agente con el ownerId proporcionado async:",
                            getOwnerId
                          );
                          ownerEdvisor = getOwnerId;
                          console.log(
                            "owner asignado justo en la funcion",
                            ownerEdvisor
                          );
                        } catch (error) {
                          console.log(
                            "Error al asginar owner - motivo:",
                            error
                          );
                        }
                      } else {
                        console.log(
                          "No se encontró un agente con el ownerId proporcionado."
                        );
                      }
                    })
                    .catch((error) => {
                      console.log(
                        "No se encontró propietario para asignar",
                        error
                      );
                    });
                } else {
                  console.log("OwnerID vacío en el payload");
                }
              } catch (error) {
                console.log("No se encontro propietario para asignar", error);
              }

              console.log(
                `Valores que se van a cargar en el negocio, totalPrice ${totalPrice}, totalCurrency ${totalCurrency}, totalAnotherPrice ${totalAnotherPrice}, totalAnotherCurrency ${totalAnotherCurrency}`
              );

              console.log("Moneda del negocio a actualizar", currencyDeal);

              let currency2 = totalCurrency !== "CAD" ? `${totalCurrency}` : "";
              let price2 = totalCurrency !== "CAD" ? `${totalPrice}` : "";

              const dealData = {
                properties: [
                  {
                    name: "dealname",
                    value: `${schoolName} - ${contactName} ${contactLName}`,
                  },
                  {
                    name: "pipeline",
                    value: PIPELINE,
                  },
                  {
                    name: "dealstage",
                    value: DEALSTAGE,
                  },
                  {
                    name: "amount",
                    value: maxTotalAmount,
                  },
                  {
                    name: "price",
                    value: price2,
                  },
                  {
                    name: "currency_2",
                    value: currency2,
                  },
                  {
                    name: "studentquoteid",
                    value: studentQuoteId,
                  },
                  {
                    name: "studentid",
                    value: studentId,
                  },
                  {
                    name: "statusdealedvisor",
                    value: true,
                  },
                  {
                    name: "deal_currency_code",
                    value: currencyDeal,
                  },
                  {
                    name: "hubspot_owner_id",
                    value: ownerEdvisor ? ownerEdvisor : "",
                  },
                  {
                    name: "quote_option_id_1",
                    value: quoteOptionId1,
                  },
                  {
                    name: "quote_option_id_2",
                    value: quoteOptionId2,
                  },
                  {
                    name: "quote_option_id_3",
                    value: quoteOptionId3,
                  },
                  {
                    name: "quote_option_id_4",
                    value: quoteOptionId4,
                  },
                  {
                    name: "quote_option_id_5",
                    value: quoteOptionId5,
                  },
                  {
                    name: "quote_option_id_6",
                    value: quoteOptionId6,
                  },
                ],
              };

              const lineItemsAssociations = [];

              // Agregar las asociaciones de line items al array
              for (let i = 0; i < lineItemsValue.length; i++) {
                const lineItem = lineItemsValue[i];
                for (const lineItemId of lineItem) {
                  const association = {
                    fromObjectId: dealIdToSearch,
                    toObjectId: lineItemId,
                    category: "HUBSPOT_DEFINED",
                    definitionId: 19,
                  };
                  lineItemsAssociations.push(association);
                }
              }

              // Agregar las asociaciones de line items Discounts al array

              for (let i = 0; i < lineItemsValueDiscount.length; i++) {
                const lineItem = lineItemsValueDiscount[i];
                for (const lineItemId of lineItem) {
                  const association = {
                    fromObjectId: dealIdToSearch,
                    toObjectId: lineItemId,
                    category: "HUBSPOT_DEFINED",
                    definitionId: 19,
                  };
                  lineItemsAssociations.push(association);
                }
              }

              console.log("Asociaciones de line items:", lineItemsAssociations);

              console.log("Valores para actualizar el negocio", dealData);

              try {
                const dealCreate = await axios.put(
                  `https://api.hubapi.com/deals/v1/deal/${dealIdToSearch}`,
                  dealData,
                  {
                    headers: {
                      Authorization: `Bearer ${hubspotApiKey}`,
                      "Content-Type": "application/json",
                    },
                  }
                );

                console.log("Negocio actualizado");

                try {
                  const associationsUpdate = await axios.put(
                    `https://api.hubapi.com/crm-associations/v1/associations/create-batch`,
                    lineItemsAssociations,
                    {
                      headers: {
                        Authorization: `Bearer ${hubspotApiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  console.log(
                    "Asociaciones de line items actualizadas en el negocio"
                  );
                } catch (error) {
                  console.error(
                    "Error al crear las asociaciones de line items",
                    error
                  );
                }

                //const newDealId = dealCreate.data.id;

                let num = 1;

                console.log(
                  "quoteStatusFinal para crear la cotizacion",
                  quoteStatusFinal
                );

                for (const lineItems of lineItemsValue) {
                  const quoteData = {
                    properties: {
                      hs_title: `${titleQuote} - Option ${num}`,
                      hs_status: quoteStatusFinal || "DRAFT",
                      hs_expiration_date:
                        eventData.after.expires ||
                        new Date(
                          Date.now() + 30 * 24 * 60 * 60 * 1000
                        ).toISOString(),
                      hs_currency: totalAnotherCurrency,
                      studentquoteid: eventData.after.studentQuoteId,
                      hs_template_type: "CUSTOMIZABLE_QUOTE_TEMPLATE",
                      hs_language: "en",
                      hs_comments: `Value of line-items expressed in Canadian dollars (CAD)`,
                      hubspot_owner_id: `${ownerEdvisor ? ownerEdvisor : ""}`,
                      hs_sender_firstname: contactFirstname,
                      hs_sender_lastname: contactLastname,
                      hs_sender_email: contactEmail,
                    },
                    associations: [
                      {
                        to: {
                          id: TEMPLATE_ID, //245775600407 Plantilla de cotizacion Modern Basic
                        },
                        types: [
                          {
                            associationCategory: "HUBSPOT_DEFINED",
                            associationTypeId: 286,
                          },
                        ],
                      },
                      /* {
                          to: {
                            id: contactId
                          },
                          types: [
                            {
                              associationCategory: "HUBSPOT_DEFINED",
                              associationTypeId: 69,
                            },
                          ],
                        }, */
                      {
                        to: {
                          id: dealIdToSearch,
                        },
                        types: [
                          {
                            associationCategory: "HUBSPOT_DEFINED",
                            associationTypeId: 64,
                          },
                        ],
                      },
                    ],
                  };

                  // Agregar asociación de line items a la cotización
                  for (const lineItemId of lineItems) {
                    const association = {
                      to: {
                        id: lineItemId,
                      },
                      types: [
                        {
                          associationCategory: "HUBSPOT_DEFINED",
                          associationTypeId: 67,
                        },
                      ],
                    };

                    quoteData.associations.push(association);
                  }

                  const quoteResponse = await axios.post(
                    "https://api.hubspot.com/crm/v3/objects/quotes",
                    quoteData,
                    {
                      headers: {
                        Authorization: `Bearer ${hubspotApiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  console.log("A punto de crear la cotizacion");

                  console.log(
                    "Nueva Cotización creada en HubSpot:",
                    quoteResponse.data
                  );

                  const quoteId = quoteResponse.data.id;

                  try {
                    console.log("...Buscando Discount para asociar");

                    // Verificamos si hay descuentos para esta cotización
                    if (
                      promotionsValue[num - 1] &&
                      promotionsValue[num - 1].length > 0
                    ) {
                      const promotions = promotionsValue[num - 1]; // Utilizamos num - 1 para obtener el índice correcto

                      // Iteramos sobre los descuentos asociados a la cotización actual
                      for (const promotionId of promotions) {
                        const updateQuote = await axios.put(
                          `https://api.hubspot.com/crm/v4/objects/quotes/${quoteId}/associations/default/discounts/${promotionId}`,
                          {},
                          {
                            headers: {
                              Authorization: `Bearer ${hubspotApiKey}`,
                              "Content-Type": "application/json",
                            },
                          }
                        );

                        console.log(
                          "Cotizacion actualizada",
                          quoteId,
                          "con el siguiente Descuento",
                          promotionId
                        );
                      }
                    }
                  } catch (error) {
                    console.error("Error", error);
                  }

                  await axios.patch(
                    `https://api.hubspot.com/crm/v3/objects/deal/${dealIdToSearch}`,
                    {
                      properties: {
                        [`quote_option_id_${num}`]: `Option ${num} ; ${quoteId}`,
                      },
                      associations: {
                        to: {
                          id: quoteId,
                        },
                        types: [
                          {
                            associationCategory: "HUBSPOT_DEFINED",
                            associationTypeId: 63,
                          },
                        ],
                      },
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${hubspotApiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );
                  num++;
                }

                try {
                  const acceptedOption = studentQuoteOptions.filter(
                    (option) => option.isAccepted === true
                  );

                  const notAcceptedOptions = studentQuoteOptions.filter(
                    (option) => option.isAccepted === false
                  );

                  const hasAcceptedOption = studentQuoteOptions.some(
                    (option) => option.isAccepted === true
                  );

                  let nameCourse;

                  if (hasAcceptedOption) {
                    console.log(
                      "Hay al menos una opción aceptada",
                      acceptedOption
                    );

                    const quoteAcceptedName = acceptedOption[0].name;
                    const quoteAcceptedPrice = acceptedOption[0].totalPrice;
                    const quoteAcceptedCurrency =
                      acceptedOption[0].priceCurrency.code;

                    const courseItem =
                      acceptedOption[0].studentQuoteOptionItems.find(
                        (item) =>
                          item.__typename === "StudentQuoteOptionCourseItem"
                      ).courseSnapshot.name;

                    if (courseItem) {
                      nameCourse = courseItem;
                    } else {
                      nameCourse = "courseNotFound";
                    }

                    for (const notAcceptedOption of notAcceptedOptions) {
                      const optionName = notAcceptedOption.name;

                      try {
                        //Buscar cotizaciones asociadas al negocio

                        const searchQuotesToDeal = await axios.post(
                          `https://api.hubspot.com/crm/v4/associations/deals/quotes/batch/read`,
                          {
                            inputs: [
                              {
                                id: dealIdToSearch,
                              },
                            ],
                          },
                          {
                            headers: {
                              Authorization: `Bearer ${hubspotApiKey}`,
                            },
                          }
                        );

                        const results = searchQuotesToDeal.data.results;

                        if (results && results.length > 0) {
                          const quotesObjectsId =
                            searchQuotesToDeal.data.results[0].to.map(
                              (item) => item.toObjectId
                            );

                          //Iterar por cotizaciones para eliminarlas

                          for (const quoteId of quotesObjectsId) {
                            await new Promise((resolve) =>
                              setTimeout(resolve, 10000)
                            );

                            //Obtener titulo de las cotizaciones

                            const searchProperties = await axios.post(
                              `https://api.hubspot.com/crm/v3/objects/quotes/search`,
                              {
                                filters: [
                                  {
                                    propertyName: "hs_object_id",
                                    operator: "EQ",
                                    value: quoteId,
                                  },
                                ],
                                properties: ["hs_title"],
                              },
                              {
                                headers: {
                                  Authorization: `Bearer ${hubspotApiKey}`,
                                },
                              }
                            );

                            if (searchProperties.data.total > 0) {
                              const hs_title =
                                searchProperties.data.results[0].properties
                                  .hs_title;

                              if (hs_title.includes(optionName)) {
                                console.log(
                                  `La cotizacion ${quoteId} coincide con ${hs_title}`
                                );

                                try {
                                  const searchLineItems = await axios.post(
                                    `https://api.hubspot.com/crm/v4/associations/quotes/line_items/batch/read`,
                                    {
                                      inputs: [
                                        {
                                          id: quoteId,
                                        },
                                      ],
                                    },
                                    {
                                      headers: {
                                        Authorization: `Bearer ${hubspotApiKey}`,
                                      },
                                    }
                                  );

                                  const lineItemsIds =
                                    searchLineItems.data.results[0].to.map(
                                      (item) => item.toObjectId
                                    );

                                  console.log(
                                    "Line imtes encontrados",
                                    lineItemsIds
                                  );

                                  for (const lineItemId of lineItemsIds) {
                                    console.log(
                                      "Line Item a eliminar",
                                      lineItemId
                                    );

                                    const deleteLineItem = await axios.delete(
                                      `https://api.hubspot.com/crm/v3/objects/line_item/${lineItemId}`,
                                      {
                                        headers: {
                                          Authorization: `Bearer ${hubspotApiKey}`,
                                        },
                                      }
                                    );

                                    console.log(
                                      `Line Item eliminado ${lineItemId}`
                                    );
                                  }

                                  try {
                                    console.log(
                                      "el QuoteID a eliminar es: ",
                                      quoteId
                                    );

                                    const deleteQuotes = await axios.delete(
                                      `https://api.hubspot.com/crm/v3/objects/quotes/${quoteId}`,
                                      {
                                        headers: {
                                          Authorization: `Bearer ${hubspotApiKey}`,
                                        },
                                      }
                                    );

                                    console.log("QuoteID eliminado");
                                  } catch (error) {
                                    console.log(
                                      "Error al eliminar quoteId",
                                      quoteId
                                    );
                                  }
                                } catch (error) {
                                  console.error("Error al eliminar line items");
                                }
                              } else {
                                console.log(
                                  `La cotizacion ${quoteId} no coincide con ${hs_title}`
                                );
                              }
                            } else {
                              console.log(
                                `No se encontraron datos para la cotizacion ${quoteId}`
                              );
                            }
                          }

                          console.log(
                            "Todos las Quotes y Line_Items fueron eliminados"
                          );
                        } else {
                          console.log("No se encontraron valores.");
                        }
                      } catch (error) {
                        console.error("Error buscar/eliminar Quotes", error);
                      }
                    }

                    //Actualizar Negocio

                    try {
                      const dealDataUpdate = {
                        properties: {
                          /* 
                              amount: , //Valor
                              deal_currency_code: , //Moneda */ //quoteAcceptedName
                          dealname: `${schoolName} - ${contactName} ${contactLName} - ${nameCourse}`,
                          currency_2: quoteAcceptedCurrency, //Moneda otra
                          price: quoteAcceptedPrice, //Valor otra
                          quoteaccepted: quoteAcceptedName,
                          quote_option_id_1: "",
                          quote_option_id_2: "",
                          quote_option_id_3: "",
                          quote_option_id_4: "",
                          quote_option_id_5: "",
                          quote_option_id_6: "",
                        },
                      };

                      const dealUpdateAccepted = await axios.patch(
                        `https://api.hubspot.com/crm/v3/objects/deals/${dealIdToSearch}`,
                        dealDataUpdate,
                        {
                          headers: {
                            Authorization: `Bearer ${hubspotApiKey}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );

                      console.log("Negocio actualizado");
                    } catch (error) {
                      console.error("Error al actualizar el negocio", error);
                    }
                  } else {
                    console.log("Todavía no hay opciones aceptadas.");
                  }
                } catch (error) {
                  console.log(
                    "Error al intentar eliminar Quotes/LineItems en IsAccepted"
                  );
                }
              } catch (error) {
                console.error("Error al crear negocio y cotización", error);

                // Detalles del error de la API de HubSpot
                console.log(
                  "Detalles del error de la API de HubSpot:",
                  error.response.data
                );

                // Mensaje de error específico
                console.log(
                  "Mensaje de error específico:",
                  error.response.data.message
                );

                // Detalles adicionales, si están disponibles
                if (
                  error.response.data.errors &&
                  error.response.data.errors.length > 0
                ) {
                  console.log(
                    "Detalles adicionales del error:",
                    error.response.data.errors
                  );
                  console.log("Primer error:", error.response.data.errors[0]);
                }
              }
            } else {
              console.log("Datos no encontrados, no es posible continuar");
            }
          } else {
            console.log(
              "No se encontró negocio asociado al siguiente quoteId",
              studentQuoteId
            );
          }

          console.log("Actualizando contacto");

          try {
            const updateContactPortalId = await axios.patch(
              `https://api.hubspot.com/crm/v3/objects/contacts/${hsContactId}`,
              {
                properties: {
                  hsportalid: portalIdToUse,
                },
              },
              {
                headers: {
                  Authorization: `Bearer ${hubspotApiKey}`,
                  "Content-Type": "application/json",
                },
              }
            );

            console.log(
              `Contacto actualizado ${studentId} y ID: ${hsContactId} con el siguiente portalId ${portalIdToUse}`
            );
          } catch (error) {
            console.error("Error al actualizar portalId en contacto", error);
          }
        } else {
          console.log("No se encontro el contacto en HubSpot por StudentId");
        }
      } catch (error) {
        console.error("Error al crear cotizacion", error);

        // Detalles del error de la API de HubSpot
        console.log(
          "Detalles del error de la API de HubSpot:",
          error.response.data
        );

        // Mensaje de error específico
        console.log(
          "Mensaje de error específico:",
          error.response.data.message
        );

        // Detalles adicionales, si están disponibles
        if (
          error.response.data.errors &&
          error.response.data.errors.length > 0
        ) {
          console.log(
            "Detalles adicionales del error:",
            error.response.data.errors
          );
          console.log("Primer error:", error.response.data.errors[0]);
        }
      }
    }
  } catch (error) {
    console.error("Error al interactuar con HubSpot:", error.response);
  }
};
