%% MAT-fem_Shells
% 3 Nodes Triangular Thick/Thin Shell Element TQQL 

% Clear memory and variables
  clear
  
% The variables are read as a MAT-fem subroutine
% young = Young Modulus
% poiss = Poission Ratio
% thick = Thickness 
% denss = Density
% coordinates = [ x , y , z ] coordinate matrix nnode x ndime (3) 
% elements    = [ inode , jnode , knode ] element connectivity’ matrix.
%               Matrix size: nelem x nnode; nnode = 3
% fixnodes    = [ node number , dof , fixed value ] matrix with 
%               Dirichlet restrictions, were dof=1,2,3 for displacements,
%               dof=4 for rotation in x' and dof=5 for rotation in y'
% pointload   = [ node number , dof , load value ] matrix with
%               nodal loads, were dof=1,2,3 for loads,
%               dof=4 for x' moment and dof=5 for y' moment
% uniload     = [ normal surface load ] sparse matrix size: nelem x 1

  file_name = input('Enter the file name: ','s');

  tic;                   % Start clock
  ttim = 0;              % Initialize time counter
  eval(file_name);       % Read input file

% Find basic dimensions
  npnod = size(coordinates,1);         % Number of nodes
  nelem = size(elements,1);            % Number of elements
  nnode = size(elements,2);            % Number of nodes per element
  dofpn = 5;                           % Number of DOF per node
  dofpe = nnode*dofpn;                 % Number of DOF per element
  nndof = npnod*dofpn;                 % Number of total DOF 

  elements = sortrows(elements);
  
  ttim = timing('Time needed to read the input file',ttim); %Reporting time

% Dimension the global matrices
  StifMat  = sparse( nndof , nndof );  % Create the global stiffness matrix
  force    = sparse( nndof , 1 );      % Create the global force vector
  force1   = sparse( nndof , 1 );      % Create the global force vector
  reaction = sparse( nndof , 1 );      % Create the global reaction vector
  u        = sparse( nndof , 1 );      % Nodal variables
  
% Material properties (Constant over the domain)
  aux1 = thick*young/(1-poiss^2);
  aux2 = poiss*aux1;
  aux3 = thick*young/2/(1+poiss);
  aux4 = (5/6)*thick*young/2/(1+poiss);
   
  D_matm = [aux1,aux2,   0;
            aux2,aux1,   0;
               0,   0,aux3];
  
  D_mats = [aux4,   0;
               0,aux4];
  
  D_matb = D_matm*(thick^2/12);
  
  ttim = timing('Time needed to  set initial values',ttim); %Reporting time

% Gauss point coordinates
  xg(1) = 1.0/6.0;
  xg(2) = 2.0/3.0;
  xg(3) = 1.0/6.0;

  yg(1) = 1.0/6.0;
  yg(2) = 1.0/6.0;
  yg(3) = 2.0/3.0;

  wg(1) = 1.0/3.0;
  wg(2) = 1.0/3.0;
  wg(3) = 1.0/3.0;
  
% Element cycle
  for ielem = 1 : nelem

    lnods(1:nnode) = elements(ielem,1:nnode);
  
    cxyz(1:6,1:3) = coordinates(lnods(1:6),1:3);      % Element coordinates
    ctrv = [ cxyz(1,1:3) ;
             cxyz(3,1:3) ;
             cxyz(5,1:3) ];
    Te = Rotation_system_v1_1(ctrv);

    la(ielem,1:3) = Te(1,1:3);
    la(ielem,4:6) = Te(2,1:3);
    la(ielem,7:9) = Te(3,1:3);

    ctxy = cxyz*transpose(Te);    % Rotate coordinates to element mid plane
    ctxy(2,1:2) = (ctxy(1,1:2) + ctxy(3,1:2))/2;   % Assume the middle node
    ctxy(4,1:2) = (ctxy(3,1:2) + ctxy(5,1:2))/2;   % in the same plane
    ctxy(6,1:2) = (ctxy(5,1:2) + ctxy(1,1:2))/2;

    x = ctxy(1:6,1); % Elem. X coordinates
    y = ctxy(1:6,2); % Elem. Y coordinates
     
    K_elem = zeros( dofpe , dofpe );

    areae = 0.0;
    fx = zeros(1,6);
    fy = zeros(1,6);
    fz = zeros(1,6);
    
    for igaus = 1 : 3

      [bmat_b,bmat_s,bmat_m,N,area] = B_mat_Shell_TQQL_v1_1(x,y,xg(igaus),yg(igaus),Te); 

      K_b = transpose(bmat_b)*D_matb*bmat_b*area*wg(igaus);
      K_m = transpose(bmat_m)*D_matm*bmat_m*area*wg(igaus);
      K_s = transpose(bmat_s)*D_mats*bmat_s*area*wg(igaus);
      
      K_elem = K_elem + K_b + K_m + K_s;
      
      areae = areae + area*wg(igaus);
      fx = fx + uniload(ielem)*area*Te(3,1)*wg(igaus)*N;
      fy = fy + uniload(ielem)*area*Te(3,2)*wg(igaus)*N;
      fz = fz + (uniload(ielem)*Te(3,3) - denss*thick)*area*wg(igaus)*N;

    end
    
    ElemFor = [fx(1),fy(1),fz(1),0,0,fx(2),fy(2),fz(2),0,0,...
               fx(3),fy(3),fz(3),0,0,fx(4),fy(4),fz(4),0,0,...
               fx(5),fy(5),fz(5),0,0,fx(6),fy(6),fz(6),0,0];

% Find the equation number list for the i-th element
    for i = 1 : nnode
      ii = (i-1)*dofpn;
      for j =1:dofpn
        eqnum(ii+j) = (lnods(i)-1)*dofpn + j;   % Build the eq. number list
      end
    end
 
% Assemble the force vector and the stiffness matrix
    for i = 1 : dofpe
      ipos = eqnum(i);
      force(ipos,1) = force(ipos,1) + ElemFor(i);
      for j = 1 : dofpe
         jpos = eqnum(j);
         StifMat (ipos,jpos) = StifMat (ipos,jpos) + K_elem(i,j);
      end
    end

  end  % End element cycle
  
  ttim = timing('Time to assemble the global system',ttim); %Reporting time

% Add point load conditions to the force vector
  for i = 1 : size(pointload,1)
    ieqn = (pointload(i,1)-1)*dofpn + pointload(i,2);   % Find eq. number
    force(ieqn,1) = force(ieqn,1) + pointload(i,3);     % and add the force
  end

  ttim = timing('Time for apply side and point load',ttim); %Reporting time

% Apply the Dirichlet conditions and adjust the right hand side
  j = 0;
  for i = 1 : size(fixnodes,1)
    ieqn = (fixnodes(i,1)-1)*dofpn + fixnodes(i,2);  % Find equation number
    u(ieqn) = fixnodes(i,3);                  % and store the solution in u
    j = j + 1;
    fix(j) = ieqn;                        % and mark the eq. as a fix value
  end
  
  force1 = force - StifMat * u;      % Adjust the rhs with the known values

% Compute the solution by solving StifMat * u = force for the remaining
% unknown values of u
  FreeNodes = setdiff( 1:nndof , fix );           % Find the free node list
                                                  % and solve for it
  u(FreeNodes) = StifMat(FreeNodes,FreeNodes) \ force1(FreeNodes);

  ttim = timing('Time to solve the stiffness matrix',ttim); %Reporting time

% Compute the reactions on the fixed nodes as R = StifMat * u - F
  reaction(fix) = StifMat(fix,1:nndof) * u(1:nndof) - force(fix);

  ttim = timing('Time to solve the  nodal reactions',ttim); %Reporting time

% Compute the stresses
  Strnod = Stress_Shell_TQQL_v1_1(D_matb,D_matm,D_mats,xg,yg,u);
  
  ttim = timing('Time to  solve the  nodal stresses',ttim); %Reporting time
  
% Graphic representation
  ToGiD_Shell_TQQL_v1_1(file_name,u,reaction,Strnod); 

  ttim = timing('Time  used to write  the  solution',ttim); %Reporting time
  itim = toc;                                               %Close last tic
  fprintf(1,'\nTotal running time %12.6f \n\n',ttim); %Reporting final time
  
