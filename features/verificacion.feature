Feature: Verificación INFOBRAS

  Como operador del RPA
  Quiero verificar las obras asignadas desde INFOBRAS
  Para revisar la ficha pública y los datos de ejecución

  Scenario: Verificar los códigos asignados desde el CSV
    Given cargo los códigos asignados desde "src/input/codigos_infobras.csv"
    When ejecuto la verificación para cada registro
    Then todas las obras deben completar la ruta de verificación
