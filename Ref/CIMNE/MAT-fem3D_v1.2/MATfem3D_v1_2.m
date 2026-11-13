%% MAT-fem 3D

% Clear memory and variables
  clear
  
% The variables are read as a MAT-fem subroutine
% young = Young Modulus
% poiss = Poission Ratio
% denss = Density
% coordinates = [ x , y , z ] coordinate matrix nnode x ndime (3)
% elements    = [ inode , jnode , knode ] element connectivity  matrix
%               nelem x nnode; nnode = 4 for tetrahedron element and 
%               nnode = 8 for hexahedron element
% fixnodes    = [ node number , dimension , fixed value ] matrix with 
%               Dirichlet restrictions
% pointload   = [ node number , dimension , load value ] matrix with 
%               nodal loads
% surfaceload = [ node numbers , x-y-z load values , loc_code ] 
%               matrix with surface loads

  file_name = input('Enter the file name: ','s');

  tic;                   % Start clock
  ttim = 0;              % Initialize time counter
  eval(file_name);       % Read input file

% Find basic dimensions
  npnod = size(coordinates,1);         % Number of nodes
  nndof = 3*npnod;                     % Number of total DOF
  nelem = size(elements,1);            % Number of elements
  nnode = size(elements,2);            % Number of nodes per element
  neleq = nnode*3;                     % Number of DOF per element

  elements = sortrows(elements);

  ttim = timing('Time needed to read the input file',ttim); %Reporting time

% Dimension the global matrices
  StifMat  = sparse( nndof , nndof );  % Create the global stiffness matrix
  force    = sparse( nndof , 1 );      % Create the global force vector
  force1   = sparse( nndof , 1 );      % Create the global force vector
  reaction = sparse( nndof , 1 );      % Create the global reaction vector

% Material properties (Constant over the domain)
  aux1 = young*(1-poiss)/((1+poiss)*(1-2*poiss));
  aux2 = poiss/(1-poiss);
  aux3 = (1-2*poiss)/(2*(1-poiss));
  
  dmat = [   1 , aux2, aux2,   0 ,   0 ,   0  ;
           aux2,   1 , aux2,   0 ,   0 ,   0  ;
           aux2, aux2,   1 ,   0 ,   0 ,   0  ;
             0 ,   0 ,   0 , aux3,   0 ,   0  ;
             0 ,   0 ,   0 ,   0 , aux3,   0  ;
             0 ,   0 ,   0 ,   0 ,   0 , aux3 ];
  dmat = dmat*aux1;

  ttim = timing('Time needed to  set initial values',ttim); %Reporting time

% Element cycle
  for ielem = 1 : nelem

% Recover element properties
    lnods = elements(ielem,:);                         % Elem. connectivity
    coord(1:nnode,:) = coordinates(lnods(1:nnode),:);  % Elem. coordinates
 
% Evaluate the elemental stiffness matrix and mass force vector
    if (nnode == 4)     % 4 Nds tetrahedron
      [ElemMat,ElemFor] = TeStif3D_v1_2(coord,dmat,denss);
    else                % 8 Nds hexahedron
      [ElemMat,ElemFor] = HeStif3D_v1_2(coord,dmat,denss);
    end
    
% Find the equation number list for the i-th element
    eqnum = [];                                            % Clear the list
    for i =1 : nnode                                       % Node cycle
      eqnum = [eqnum,lnods(i)*3-2,lnods(i)*3-1,lnods(i)*3];   % Build eq. 
    end                                                       % number list

% Assemble the force vector and the stiffness matrix
    force(eqnum) = force(eqnum) + ElemFor';
    StifMat(eqnum,eqnum) = StifMat(eqnum,eqnum) + ElemMat;

  end  % End element cycle

  ttim = timing('Time to assemble the global system',ttim); %Reporting time

% Add global side forces to the force vector
  coord = [];                                           % Clear coordinates
  nloads = size(surfaceload,1);
  if (nloads ~= 0)
    nsnod = size(surfaceload,2) - 4;
    for i = 1 : nloads
      lnods = surfaceload(i,1:nsnod);                   %Elem. connectivity
      coord(1:nsnod,:) = coordinates(lnods(1:nsnod),:); %Elem. coordinates
      sidfo(1:3) = surfaceload(i,nsnod+1:nsnod+3);
      loc_code   = surfaceload(i,nsnod+4);

% Find the equation number list for the i-th element
      eqnum = [];                                          % Clear the list
      for j =1 : nsnod                                     % Node cycle
        eqnum = [eqnum,lnods(j)*3-2,lnods(j)*3-1,lnods(j)*3]; % Build eq. 
      end                                                     % number list
      if (nsnod == 3)  % 3 Nds triangular face
        SideFor = TrFor3D_v1_2(coord,sidfo,loc_code);
      else             % 4 Nds quadrilateral face
        SideFor = QdFor3D_v1_2(coord,sidfo,loc_code);
      end
      force(eqnum) = force(eqnum) + SideFor';
    end
  end
    
% Add point load conditions to the force vector
  for i = 1 : size(pointload,1)
    ieqn = (pointload(i,1)-1)*3 + pointload(i,2);         % Find eq. number
    force(ieqn) = force(ieqn) + pointload(i,3);           % Add the force
  end

  ttim = timing('Time for apply side and point load',ttim); %Reporting time

% Apply the Dirichlet conditions and adjust the right hand side
  u = sparse( nndof, 1 );
  for i = 1 : size(fixnodes,1)
    ieqn = (fixnodes(i,1)-1)*3 + fixnodes(i,2);  % Find the equation number
    u(ieqn) = fixnodes(i,3);                  % and store the solution in u
    fix(i) = ieqn;                        % and mark the eq. as a fix value
  end
  
  force1 = force - StifMat * u;      % Adjust the rhs with the known values

% Compute the solution by solving StifMat * u = force for the remaining
% unknown values of u
  FreeNodes = setdiff(1:nndof,fix);           % Find the free node list and
                                              % solve for it
  u(FreeNodes) = StifMat(FreeNodes,FreeNodes) \ force1(FreeNodes);

% Compute the reactions on the fixed nodes as R = StifMat * u - F
  reaction(fix) = StifMat(fix,1:nndof) * u(1:nndof) - force(fix);
  
  ttim = timing('Time to solve the stiffness matrix',ttim); %Reporting time

% Compute the stresses
  Strnod = Stress3D_v1_2(dmat,u);

  ttim = timing('Time to  solve the  nodal stresses',ttim); %Reporting time
  
% Graphic representation
  ToGiD3D_v1_2(file_name,u,reaction,Strnod);

  ttim = timing('Time  used to write  the  solution',ttim); %Reporting time
  itim = toc;                                               %Close last tic
  fprintf(1,'\nTotal running time %12.6f \n\n',ttim); %Reporting final time

