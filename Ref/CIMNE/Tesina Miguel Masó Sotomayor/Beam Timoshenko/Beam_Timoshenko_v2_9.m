%% 2 Nodes Beam using Timoshenko Theory. Composite laminated plane beams
%  Exact integration of K_shear 
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
%               displacement, where dof=2 for vertical displacement
%               and dof=3 for vertical derivative
% pointload   = [node number, dof, load value] matrix with 
%               nodal loads, were dof=1 for horizontal load, dof=2
%               for vertical load and dof=3 for moment.
% uniload    = [ uniform vertical load ] sparse matrix size: nelem x 2

  file_name = input('Enter the file name : ','s');
% folder    = input('Enter an output folder : ','s');
  
  tic;                   % Start clock
  ttim = 0;              % Initialize time counter
  eval (file_name);      % Read input file
  
% Finds basics dimensions
  nlayr  = size(young,1);              % Number of layers
  npnod  = size(coordinates,1);        % Number of nodes
  nelem  = size(elements,1);           % Number of elements
  nnode  = size(elements,2);           % Number of nodes por element
  dofpn  = 3;                          % Number of DOF per node
  dofpe  = nnode*dofpn;                % Number of DOF per element
  nndof  = npnod*dofpn;                % Number of total DOF 

  ttim = timing('Time needed to read the input file',ttim); %Reporting time

%% Initial values
% Dimension the global matrices.
  StifMat  = sparse ( nndof , nndof ); % Create the global stiffness matrix
  force    = sparse ( nndof , 1 );     % Create the global force vector
  reaction = sparse ( nndof , 1 );     % Create the global reaction vector
  u        = sparse (nndof, 1);        % Nodal variables

% Check data
  young = sortrows(young,1);               % Sort material data
  young = young(:,2);
  poiss = sortrows(poiss,1);
  poiss = poiss(:,2);
  denss = sortrows(denss,1);
  denss = denss(:,2);
  hlayr = sortrows(hlayr,1);
  hlayr = hlayr(:,2);
  
  [condnum c] = find(fixnodes(:,2)==4);    % Compatibility with zigzag
  condnum = setdiff(1:size(fixnodes,1),condnum);
  fixnodes = fixnodes(condnum,:);
% Generalized constitutive matrix.
  hsect = sum(hlayr);
  shear = young./(2*(1+poiss));

  zlayr = zeros (nlayr + 1,1);
  mlayr = zeros (nlayr,1);
  for ilayr = 1 : nlayr
    zlayr(ilayr + 1) = zlayr(ilayr) + hlayr(ilayr);
    mlayr(ilayr) = zlayr(ilayr) + hlayr(ilayr)/2;
  end
  zlayr = zlayr - hsect/2;
  mlayr = mlayr - hsect/2;

  weight  = 0;
  D_la  = zeros(nlayr,1);        % Layer stiffness
  D_lb  = zeros(nlayr,1);
  D_lab = zeros(nlayr,1);
  G_l   = zeros(nlayr,1);
  for ilayr = 1 : nlayr
    weight  = weight  + hlayr(ilayr)*blayr(ilayr)*denss(ilayr);
    D_la(ilayr)  =  hlayr(ilayr)*blayr(ilayr)*young(ilayr);
    D_lb(ilayr)  =  1/3*(zlayr(ilayr+1)^3 - zlayr(ilayr)^3)*blayr(ilayr)*young(ilayr);
    D_lab(ilayr) = -hlayr(ilayr)*blayr(ilayr)*mlayr(ilayr)*young(ilayr);
    G_l(ilayr)   =  hlayr(ilayr)*blayr(ilayr)*shear(ilayr);
  end
  D_mata  = sum(D_la);           % Section stiffness
  D_matb  = sum(D_lb);
  D_matab = sum(D_lab);
  G_mat   = sum(G_l);
  D_mat   = D_mata * D_matb - D_matab^2;

  dnaxs = -D_matab/D_mata;       % Axis translation
  znaxs = zlayr - dnaxs;
  mnaxs = mlayr - dnaxs;

  D_naxab = 0;                   % New coupling axial-bending stiffness
  D_naxb  = 0;                   % New bending stifness
  for ilayr = 1 : nlayr
    D_naxb = D_naxb + 1/3*(znaxs(ilayr+1)^3 - znaxs(ilayr)^3)*blayr(ilayr)*young(ilayr);
  end

  S1 = 0;                        % Compute the shear correction parameter
  S3 = 0;
  for jlayr = 1 : nlayr
    if jlayr > 1
      S1 = S1 + young(jlayr-1)* (zlayr(jlayr)^2 - zlayr(jlayr-1)^2);
    end
    S2 = 1/4*(S1-young(jlayr)*zlayr(jlayr)^2)^2               *(zlayr(jlayr+1)  -zlayr(jlayr)  )+...
         1/6*(S1-young(jlayr)*zlayr(jlayr)^2)  *young(jlayr)  *(zlayr(jlayr+1)^3-zlayr(jlayr)^3)+...
         1/20                                  *young(jlayr)^2*(zlayr(jlayr+1)^5-zlayr(jlayr)^5);
    S3 = S3 + blayr(jlayr)/shear(jlayr)*S2 ;
  end
  kz = D_naxb^2/G_mat/S3;        % Shear correction parameter
  D_ls = kz*G_l;                 % Layer shear stiffness
  D_mats = kz*G_mat;             % Section shear stiffness

  ttim = timing('Time needed to  set initial values',ttim); %Reporting time

%% Element cycle.
  for ielem = 1 : nelem
      
    lnods(1:nnode) = elements(ielem,1:nnode);
 
    coor_x(1:nnode) = coordinates(lnods(1:nnode),1); % Elem. X coordinate

    len = coor_x(2) - coor_x(1);  % x_j > x_i
    
    const   = D_mata/len;
    
    K_axial = [ 1 ,  0 ,  0 , -1 ,  0 ,  0 ;
                0 ,  0 ,  0 ,  0 ,  0 ,  0 ;
                0 ,  0 ,  0 ,  0 ,  0 ,  0 ;
               -1 ,  0 ,  0 ,  1 ,  0 ,  0 ;
                0 ,  0 ,  0 ,  0 ,  0 ,  0 ;
                0 ,  0 ,  0 ,  0 ,  0 ,  0 ];
    
    K_axial = K_axial * const;
    
    const   = D_matb/len;
    
    K_bend  = [ 0 ,  0 ,  0 ,  0 ,  0 ,  0 ;
                0 ,  0 ,  0 ,  0 ,  0 ,  0 ;
                0 ,  0 ,  1 ,  0 ,  0 , -1 ;
                0 ,  0 ,  0 ,  0 ,  0 ,  0 ;
                0 ,  0 ,  0 ,  0 ,  0 ,  0 ;
                0 ,  0 , -1 ,  0 ,  0 ,  1 ];
            
    K_bend  = K_bend * const;
    
    const   = D_matab/len;
    
    K_axbn  = [ 0 ,  0 ,  1 ,  0 ,  0 , -1 ;
                0 ,  0 ,  0 ,  0 ,  0 ,  0 ;
                0 ,  0 ,  0 ,  0 ,  0 ,  0 ;
                0 ,  0 , -1 ,  0 ,  0 ,  1 ;
                0 ,  0 ,  0 ,  0 ,  0 ,  0 ;
                0 ,  0 ,  0 ,  0 ,  0 ,  0 ];
           
    K_axbn  = K_axbn * const;
      
    const   =   D_mats/len;
    
    K_shear = [   0   ,   0   ,     0   ,  0  ,    0   ,     0   ;
                  0   ,   1   ,   len/2 ,  0  ,   -1   ,   len/2 ;
                  0   , len/2 , len^2/3 ,  0  , -len/2 , len^2/6 ;
                  0   ,   0   ,     0   ,  0  ,    0   ,     0   ;
                  0   ,  -1   ,  -len/2 ,  0  ,    1   ,  -len/2 ;
                  0   , len/2 , len^2/6 ,  0  , -len/2 ,  len^2/3 ];
            
    K_shear = K_shear * const;
            
    K_elem  = K_axial + K_bend + K_axbn + K_axbn' + K_shear;
        
    f1      = (              uniload(ielem,1))*len/2;
    f2      = (-weight +     uniload(ielem,2))*len/2;
    ElemFor = [ f1, f2, 0 , f1, f2, 0];

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
  reaction(fix) = StifMat(fix,1:nndof) * u(1:nndof) - force(fix);

  ttim = timing('Time to solve the  nodal reactions',ttim); %Reporting time

%% Compute the stresses
  StrNod = Stress_Beam_Timoshenko_v2_9(D_mata,D_matb,D_matab,D_mats,u);

  [lDspNod lStrNod lResStrGP] = Composite_Beam_Timoshenko_v2_9 ...
                             (young,shear,kz,zlayr,D_la,D_lb,D_lab,D_ls,u);

  ttim = timing('Time to  solve the  nodal stresses',ttim); %Reporting time


%% Graphic representation.
  ToGiD_Beam_Timoshenko_v2_9(file_name,zlayr,u,reaction,StrNod,lDspNod,lStrNod,lResStrGP); 

  ttim = timing('Time  used to write  the  solution',ttim); %Reporting time
  itim = toc;                                               %Close last tic
  fprintf(1,'\n Total running time %12.6f \n',ttim);  %Reporting final time


 