%% 2 Nodes Beam using the linear refined ZigZag Timoshenko Theory, LRZ. 
%  Composite laminated plane beams
%  Reduced integration of K_s, K_s_psi and K_psi matrices
%
% Clear memory and variables.
  clear
  
% The variables are read as a MAT-fem subroutine
% young   =   Young Modulus
% poiss   =   Poission Ratio
% denss   =   Material density
% blayr   =   Cross section layer width
% hlayr   =   Cross section layer width
% coordinates = [ x ] matrix size: nnode x ndime (1)
% elements    = [ inode, jnode ] element conectivity matrix
%               matrix size: nelem x nnode; nnode = 2 
% fixnodes    = [node number, dof, fixed value] matrix with 
%               Dirichlet restrictions, were dof=1 for horizontal
%               displacement, where dof=2 for vertical displacement,
%               dof=3 for vertical derivative and dof=4 for ZigZag
%               amplitude function
% pointload   = [node number, dof, load value] matrix with 
%               nodal loads, were dof=1 for horizontal load, dof=2
%               for vertical load and dof=3 for moment.
% uniload    = [ uniform vertical load ] sparse matrix size: nelem x 2

  file_name = input('Enter the file name : ','s');
  
  tic;                   % Start clock
  ttim = 0;              % Initialize time counter
  eval (file_name);      % Read input file
  
% Finds basics dimensions
  nlayr  = size(young,1);              % Number of layers
  npnod  = size(coordinates,1);        % Number of nodes
  nelem  = size(elements,1);           % Number of elements
  nnode  = size(elements,2);           % Number of nodes por element
  dofpn  = 4;                          % Number of DOF per node
  dofpe  = nnode*dofpn;                % Number of DOF per element
  nndof  = npnod*dofpn;                % Number of total DOF 

  ttim = timing('Time needed to read the input file',ttim); %Reporting time

%% Initial values
% Dimension the global matrices.
  StifMat  = sparse ( nndof , nndof ); % Create the global stiffness matrix
  force    = sparse ( nndof , 1 );     % Create the global force vector
  reaction = sparse ( nndof , 1 );     % Create the global reaction vector
  u        = sparse ( nndof, 1);        % Nodal variables

% Material properties and section dimensions
  young = sortrows(young,1);
  young = young(:,2);
  poiss = sortrows(poiss,1);
  poiss = poiss(:,2);
  denss = sortrows(denss,1);
  denss = denss(:,2);
  hlayr = sortrows(hlayr,1);
  hlayr = hlayr(:,2);

  hsect = sum(hlayr);
  shear = young./(2*(1+poiss));

  zlayr = zeros (nlayr + 1,1);
  mlayr = zeros (nlayr,1);
  dz2 = zeros (nlayr,1);
  dz3 = zeros (nlayr,1);
  weight= 0;
  for k = 1 : nlayr
    zlayr(k + 1) = zlayr(k) + hlayr(k);
    mlayr(k) = zlayr(k) + hlayr(k)/2;
    weight   = weight + hlayr(k)*blayr(k)*denss(k);
  end
  zlayr = zlayr - hsect/2;
  mlayr = mlayr - hsect/2;
  for k = 1 : nlayr
    dz2(k)   = zlayr(k+1)^2 - zlayr(k)^2;
    dz3(k)   = zlayr(k+1)^3 - zlayr(k)^3;
  end

% ZigZag function
  G = 0;
  for k = 1 : nlayr
    G = G + hlayr(k)/shear(k);
  end
  G = hsect/G;

  beta = zeros(nlayr,1);
  phi  = zeros(nlayr+1,1);
  for k = 1 : nlayr
    beta(k) = G/shear(k) - 1;
    phi(k+1)= phi(k) + beta(k)*hlayr(k);
  end

% Generalized constitutive matrix.
  D_lp  = zeros(3,3,nlayr);        % In-plane stiffness
  D_lt  = zeros(2,2,nlayr);        % Transverse stiffness
  for k = 1 : nlayr
    D_lp(1,1,k) =  young(k)*blayr(k)*hlayr(k);
    D_lp(2,2,k) =  young(k)*blayr(k)*dz3(k)/3;
    D_lp(3,3,k) =  young(k)*blayr(k)*hlayr(k)*(phi(k+1)^3-phi(k)^3)/(phi(k+1)-phi(k))/3;
    D_lp(1,2,k) = -young(k)*blayr(k)*hlayr(k)*mlayr(k);
    D_lp(1,3,k) =  young(k)*blayr(k)*hlayr(k)*(phi(k+1)+phi(k))/2;
    D_lp(2,3,k) = -young(k)*blayr(k)*((phi(k+1)+phi(k))*dz2(k)/4 ...
        + (phi(k+1)-phi(k))*(dz3(k)/6-mlayr(k)*dz2(k)/4)/hlayr(k));
    D_lp(2,1,k) =  D_lp(1,2,k);
    D_lp(3,1,k) =  D_lp(1,3,k);
    D_lp(3,2,k) =  D_lp(2,3,k);
    
    D_s = hlayr(k)*blayr(k)*shear(k);
    D_lt(1,1,k) =  D_s;
    D_lt(2,2,k) =  D_s * beta(k)^2;
    D_lt(1,2,k) =  G*blayr(k)*hlayr(k) - D_s;
    D_lt(2,1,k) =  D_lt(1,2,k);
  end
  D_matp  = sum(D_lp,3);           % In-plane section stiffness
  D_matt  = sum(D_lt,3);           % Transverse section stiffness

  ttim = timing('Time needed to  set initial values',ttim); %Reporting time

%% Element cycle.
  for ielem = 1 : nelem

    lnods(1:nnode) = elements(ielem,1:nnode);

    coor_x(1:nnode) = coordinates(lnods(1:nnode),1); % Elem. X coordinate

    len = coor_x(2) - coor_x(1);  % x_j > x_i

    B_matp = [-1/len,   0  ,   0  ,   0  , 1/len,   0  ,   0  ,   0  ;
                 0  ,   0  ,-1/len,   0  ,   0  ,   0  , 1/len,   0  ;
                 0  ,   0  ,   0  ,-1/len,   0  ,   0  ,   0  , 1/len];

    K_p = len * B_matp' * D_matp * B_matp;

    const   = D_matt(1,1)/len;

    K_s = [  0  ,   0   ,     0   ,  0  ,  0  ,   0   ,     0   ,  0  ;
             0  ,   1   ,   len/2 ,  0  ,  0  ,  -1   ,   len/2 ,  0  ;
             0  , len/2 , len^2/4 ,  0  ,  0  ,-len/2 , len^2/4 ,  0  ;
             0  ,   0   ,     0   ,  0  ,  0  ,   0   ,     0   ,  0  ;
             0  ,   0   ,     0   ,  0  ,  0  ,   0   ,     0   ,  0  ;
             0  ,  -1   ,  -len/2 ,  0  ,  0  ,   1   ,  -len/2 ,  0  ;
             0  , len/2 , len^2/4 ,  0  ,  0  ,-len/2 , len^2/4 ,  0  ; 
             0  ,   0   ,     0   ,  0  ,  0  ,   0   ,     0   ,  0  ];

    K_s = K_s * const;

    const = D_matt(2,2)/len;

    K_psi = [  0  ,  0  ,  0  ,    0    ,  0  ,  0  ,  0  ,    0    ;
               0  ,  0  ,  0  ,    0    ,  0  ,  0  ,  0  ,    0    ;
               0  ,  0  ,  0  ,    0    ,  0  ,  0  ,  0  ,    0    ;
               0  ,  0  ,  0  , len^2/4 ,  0  ,  0  ,  0  , len^2/4 ;
               0  ,  0  ,  0  ,    0    ,  0  ,  0  ,  0  ,    0    ;
               0  ,  0  ,  0  ,    0    ,  0  ,  0  ,  0  ,    0    ;
               0  ,  0  ,  0  ,    0    ,  0  ,  0  ,  0  ,    0    ;
               0  ,  0  ,  0  , len^2/4 ,  0  ,  0  ,  0  , len^2/4 ];

    K_psi = K_psi * const;

    const = D_matt(1,2)/len;

    K_s_psi = [  0  ,  0  ,  0  ,    0    ,  0  ,  0  ,  0  ,    0    ;
                 0  ,  0  ,  0  , -len/2  ,  0  ,  0  ,  0  , -len/2  ;
                 0  ,  0  ,  0  ,-len^2/4 ,  0  ,  0  ,  0  ,-len^2/4 ;
                 0  ,  0  ,  0  ,    0    ,  0  ,  0  ,  0  ,    0    ;
                 0  ,  0  ,  0  ,    0    ,  0  ,  0  ,  0  ,    0    ;
                 0  ,  0  ,  0  ,  len/2  ,  0  ,  0  ,  0  ,  len/2  ;
                 0  ,  0  ,  0  ,-len^2/4 ,  0  ,  0  ,  0  ,-len^2/4 ;
                 0  ,  0  ,  0  ,    0    ,  0  ,  0  ,  0  ,    0    ];

    K_s_psi = K_s_psi * const;

    K_elem = K_p + K_s + K_psi + K_s_psi + K_s_psi';

    f1      = (          uniload(ielem,1))*len/2;
    f2      = (-weight + uniload(ielem,2))*len/2;
    ElemFor = [ f1, f2, 0 , 0 , f1, f2, 0 , 0 ];

% Finds the equation number list for the i-th element
    for i=1:nnode
      ii = (i-1)*dofpn;
      for j =1:dofpn
        eqnum(ii+j) = (lnods(i)-1)*dofpn+j; % Build the equation number list
      end
    end

% Assemble the force vector and the stiffness matrix
    for i = 1 : dofpe
      ipos = eqnum(i);
      force (ipos) = force(ipos)  + ElemFor(i);
      for j = 1 : dofpe
        jpos = eqnum(j);
        StifMat (ipos,jpos) = StifMat (ipos,jpos) + K_elem(i,j);
      end
    end
    
  end  % End element cycle

  ttim = timing('Time to assemble the global system',ttim); %Reporting time

%% Add point loads conditions to the force vector
  for i = 1 : size(pointload,1)
    ieqn = (pointload(i,1)-1)*dofpn+pointload(i,2);      % Finds eq. number
    force(ieqn) = force(ieqn) + pointload(i,3);          % add the force
  end

  ttim = timing('Time for apply side and point load',ttim); %Reporting time

%% Applies the Dirichlet conditions and adjust the right hand side.

  for i = 1 : size(fixnodes,1)
    ieqn = (fixnodes(i,1)-1)*dofpn+fixnodes(i,2);       % Finds eq. number
    u (ieqn) = fixnodes(i,3);                % and store the solution in u
    fix(i) = ieqn;                        % and mark the eq as a fix value
  end

  forceDC = force  - StifMat  * u;   % adjust the rhs with the known values

% Compute the solution by solving StifMat * u = force for the 
% remaining unknown values of u.
  FreeNodes = setdiff ( 1:nndof, fix ); % Finds the free node list and

  u(FreeNodes) = StifMat(FreeNodes,FreeNodes) \ forceDC(FreeNodes);

  ttim = timing('Time to solve the stiffness matrix',ttim); %Reporting time

%% Compute the reactions on the fixed nodes as a R = StifMat * u - F
  reaction = sparse(nndof,1);
  reaction(fix) = StifMat(fix,1:nndof) * u(1:nndof) - force(fix);

  ttim = timing('Time to solve the  nodal reactions',ttim); %Reporting time

%% Compute the stresses
  StrNod = Stress_Beam_LRZ_v1_1(D_matp,D_matt,u);

  [lDspNod lStrNod lResStrGP] = Composite_Beam_LRZ_v1_1 ...
                       (young,shear,zlayr,phi,beta,D_lp,D_lt,u);

  [shrStr coor_z] = ShearNz_Beam_LRZ_v1_1 (young,zlayr,lStrNod);

  ttim = timing('Time to  solve the  nodal stresses',ttim); %Reporting time

%% Graphic representation.
  ToGiD_Beam_LRZ_v1_1(file_name,zlayr,u,reaction,StrNod,lDspNod,lStrNod,lResStrGP); 

  ttim = timing('Time  used to write  the  solution',ttim); %Reporting time
  itim = toc;                                               %Close last tic
  fprintf(1,'\n Total running time %12.6f \n',ttim);  %Reporting final time


 